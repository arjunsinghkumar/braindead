"""BrainFlow OpenBCI Ganglion wrapper for NeuroFlow.

Handles BLE pairing/connect (via the BLED112 dongle's serial port),
streaming, and channel mapping. No simulation paths.
"""
from __future__ import annotations
import glob
import sys
import threading
import time
import numpy as np

from brainflow.board_shim import BoardShim, BrainFlowInputParams, BoardIds


# Logical channel mapping per the spec (Ganglion +1..+4)
CHANNEL_LABELS = ["Cz", "C3", "C4", "Spare"]
ACTIVE_CHANNELS = ["Cz", "C3", "C4"]  # the 3 we use for analysis


def list_serial_ports() -> list[str]:
    """Return likely BLED112 / serial ports for the current OS.

    Filters down to USB-modem / USB-serial style devices on macOS/Linux,
    and returns COM ports on Windows.
    """
    plat = sys.platform
    candidates: list[str] = []
    if plat.startswith("darwin"):
        candidates += glob.glob("/dev/cu.usbmodem*")
        candidates += glob.glob("/dev/cu.usbserial*")
        candidates += glob.glob("/dev/tty.usbmodem*")
    elif plat.startswith("linux"):
        candidates += glob.glob("/dev/ttyACM*")
        candidates += glob.glob("/dev/ttyUSB*")
    elif plat.startswith("win"):
        try:
            from serial.tools import list_ports  # pyserial, optional
            candidates += [p.device for p in list_ports.comports()]
        except Exception:
            candidates += [f"COM{i}" for i in range(1, 21)]
    # de-dupe, stable order
    seen = set()
    out = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out


class BoardManager:
    """Thread-safe wrapper around BrainFlow's BoardShim for the Ganglion."""

    def __init__(self):
        self.board: BoardShim | None = None
        self.board_id: int | None = None
        self.eeg_channels: list[int] = []
        self.battery_channel: int | None = None
        self.sampling_rate: int = 0
        self.connected: bool = False
        self.serial_port: str | None = None
        self._lock = threading.Lock()

    def connect(self, serial_port: str) -> dict:
        """Pair + connect to a Ganglion via the BLED112 dongle on `serial_port`.

        BrainFlow handles BLE discovery + pairing internally inside
        `prepare_session()`. Raises on failure.
        """
        if not serial_port:
            raise ValueError(
                "A serial port is required (BLED112 dongle, e.g. "
                "/dev/cu.usbmodem* on macOS, /dev/ttyACM0 on Linux, COM4 on Windows)."
            )
        if self.connected:
            self.disconnect()

        params = BrainFlowInputParams()
        params.serial_port = serial_port
        self.serial_port = serial_port
        self.board_id = BoardIds.GANGLION_BOARD.value

        BoardShim.disable_board_logger()
        self.board = BoardShim(self.board_id, params)
        self.board.prepare_session()  # BLE handshake + Ganglion pairing
        self.board.start_stream(45000)
        self.eeg_channels = BoardShim.get_eeg_channels(self.board_id)
        self.sampling_rate = BoardShim.get_sampling_rate(self.board_id)
        try:
            self.battery_channel = BoardShim.get_battery_channel(self.board_id)
        except Exception:
            self.battery_channel = None
        self.connected = True
        # Allow the ring buffer to fill briefly before first read
        time.sleep(0.5)
        return self.status()

    def disconnect(self):
        with self._lock:
            if self.board is not None:
                try:
                    self.board.stop_stream()
                except Exception:
                    pass
                try:
                    self.board.release_session()
                except Exception:
                    pass
            self.board = None
            self.connected = False

    def status(self) -> dict:
        return {
            "connected": self.connected,
            "board_id": self.board_id,
            "board_name": "Ganglion" if self.connected else None,
            "sampling_rate": self.sampling_rate,
            "eeg_channels": self.eeg_channels,
            "channel_labels": CHANNEL_LABELS,
            "active_channels": ACTIVE_CHANNELS,
            "serial_port": self.serial_port,
        }

    def get_recent_window(self, seconds: float) -> np.ndarray | None:
        """Return the most recent `seconds` of full board data (channels x samples)."""
        if not self.connected or self.board is None:
            return None
        n = max(int(self.sampling_rate * seconds), 1)
        with self._lock:
            try:
                data = self.board.get_current_board_data(n)
            except Exception:
                return None
        if data is None or data.size == 0:
            return None
        return data

    def get_eeg_window(self, seconds: float) -> dict | None:
        """Return {label: 1-D array of µV samples} for the active EEG channels."""
        data = self.get_recent_window(seconds)
        if data is None:
            return None
        out = {}
        for i, label in enumerate(ACTIVE_CHANNELS):
            if i >= len(self.eeg_channels):
                break
            row = self.eeg_channels[i]
            if row >= data.shape[0]:
                continue
            out[label] = np.ascontiguousarray(data[row]).astype(np.float64)
        return out

    def get_battery_percent(self) -> float | None:
        """Return latest battery % reported by the Ganglion, or None if unavailable.

        BrainFlow places the battery reading on a dedicated row in the data
        matrix (`get_battery_channel`). The Ganglion reports it intermittently,
        so we look at the most recent ~5 s of data and return the last non-zero
        value. Does NOT consume the ring buffer.
        """
        if not self.connected or self.board is None or self.battery_channel is None:
            return None
        n = max(int((self.sampling_rate or 200) * 5), 1)
        with self._lock:
            try:
                data = self.board.get_current_board_data(n)
            except Exception:
                return None
        if data is None or data.size == 0 or self.battery_channel >= data.shape[0]:
            return None
        row = data[self.battery_channel]
        # Drop zeros / NaNs — Ganglion fills idle samples with 0
        valid = row[(row > 0) & (row <= 100)]
        if valid.size == 0:
            return None
        return float(valid[-1])

    def pop_all_data(self):
        """Drain the ring buffer (used between sessions to start fresh)."""
        if not self.connected or self.board is None:
            return None
        with self._lock:
            try:
                return self.board.get_board_data()
            except Exception:
                return None
