import { useState } from "react";

export default function ConnectionPanel({ board, onConnect, onDisconnect }) {
  const [macAddress, setMacAddress] = useState("");

  return (
    <div className="card max-w-xl">
      <h2 className="font-semibold text-lg mb-1">Connect to OpenBCI Ganglion</h2>
      <p className="text-xs text-terminal-dim mb-4 font-terminal">
        Pair the Ganglion using normal OS Bluetooth first, then connect here.
        If you know the device MAC address, enter it to use native BLE mode.
      </p>

      {board?.connected ? (
        <div className="space-y-3">
          <div className="text-sm text-terminal-text font-terminal">
            <div>
              Connected to <span className="font-mono">Ganglion</span>{" "}
              ({board.sampling_rate} Hz)
            </div>
            <div className="text-xs text-terminal-dim mt-1">
              Mode: <span className="font-mono">{board.connection || "—"}</span>
            </div>
            <div className="text-xs text-terminal-dim">
              Channels: {board.active_channels?.join(", ")}
            </div>
          </div>
          <button className="btn-danger" onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-terminal-dim font-terminal">
                Ganglion MAC address (optional)
              </label>
            </div>
            <input
              type="text"
              placeholder="AA:BB:CC:DD:EE:FF"
              className="w-full bg-ink-800 px-3 py-2 rounded text-sm font-mono border border-terminal-accent/60 focus:outline-none focus:ring-2 focus:ring-terminal-accent/30"
              value={macAddress}
              onChange={(e) => setMacAddress(e.target.value)}
            />
            <p className="text-xs text-terminal-dim mt-1 font-terminal">
              Leave blank to use default connection settings (or server env `GANGLION_MAC`).
            </p>
          </div>
          <button
            className="btn-primary w-full"
            onClick={() => onConnect({ mac_address: macAddress.trim() || undefined })}
          >
            Connect
          </button>
        </div>
      )}
    </div>
  );
}
