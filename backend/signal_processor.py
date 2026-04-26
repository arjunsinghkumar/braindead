"""DSP utilities wrapping BrainFlow's DataFilter for NeuroFlow.

All functions accept 1-D numpy arrays of microvolt EEG samples.
"""
from __future__ import annotations
import math
import numpy as np

try:
    from brainflow.data_filter import (
        DataFilter, FilterTypes, DetrendOperations, WindowOperations
    )
    HAS_BRAINFLOW = True
except Exception:  # pragma: no cover
    HAS_BRAINFLOW = False


# Standard EEG band edges (Hz)
BANDS = {
    "delta": (1.0, 4.0),
    "theta": (4.0, 8.0),
    "alpha": (8.0, 12.0),
    "beta":  (12.0, 30.0),
    "gamma": (30.0, 50.0),
}


def _next_pow2(n: int) -> int:
    return 1 << (n - 1).bit_length()


def preprocess(signal: np.ndarray, fs: int, notch_hz: int = 60) -> np.ndarray:
    """Detrend, bandpass 1-50Hz, notch the mains frequency.

    Operates in-place via BrainFlow's DataFilter; returns the modified copy.
    """
    if signal.size == 0:
        return signal
    sig = np.ascontiguousarray(signal.astype(np.float64))
    if not HAS_BRAINFLOW:
        # Minimal fallback: detrend by subtracting mean
        sig = sig - np.mean(sig)
        return sig
    DataFilter.detrend(sig, DetrendOperations.LINEAR.value)
    # Bandpass 1-50 Hz, 4th order Butterworth
    DataFilter.perform_bandpass(
        sig, fs, 1.0, 50.0, 4, FilterTypes.BUTTERWORTH.value, 0
    )
    # Notch (band-stop) ~ mains
    low = max(notch_hz - 2.0, 0.5)
    high = notch_hz + 2.0
    DataFilter.perform_bandstop(
        sig, fs, low, high, 4, FilterTypes.BUTTERWORTH.value, 0
    )
    return sig


def compute_psd(signal: np.ndarray, fs: int):
    """Return (freqs, psd) using Welch's method with a Hanning window.

    Falls back to numpy FFT if BrainFlow isn't available.
    """
    if signal.size < 8:
        return np.array([0.0]), np.array([0.0])
    if HAS_BRAINFLOW:
        # nfft must be power of 2 and <= signal length
        nfft = _next_pow2(min(len(signal), max(64, fs)))
        if nfft > len(signal):
            nfft = _next_pow2(len(signal)) // 2
            nfft = max(nfft, 32)
        sig = np.ascontiguousarray(signal.astype(np.float64))
        try:
            psd, freqs = DataFilter.get_psd_welch(
                sig, nfft, nfft // 2, fs, WindowOperations.HANNING.value
            )
            return np.asarray(freqs), np.asarray(psd)
        except Exception:
            pass
    # numpy fallback (rough)
    n = len(signal)
    win = np.hanning(n)
    s = (signal - np.mean(signal)) * win
    fft = np.fft.rfft(s)
    psd = (np.abs(fft) ** 2) / (fs * (win ** 2).sum())
    freqs = np.fft.rfftfreq(n, 1.0 / fs)
    return freqs, psd


def band_power(signal: np.ndarray, fs: int, low: float, high: float) -> float:
    """Average power in [low, high] Hz."""
    freqs, psd = compute_psd(signal, fs)
    if freqs.size < 2:
        return 0.0
    mask = (freqs >= low) & (freqs <= high)
    if not np.any(mask):
        return 0.0
    return float(np.trapz(psd[mask], freqs[mask]))


def all_band_powers(signal: np.ndarray, fs: int) -> dict:
    """Return dict of band -> power for the standard 5 bands."""
    freqs, psd = compute_psd(signal, fs)
    out = {}
    for name, (lo, hi) in BANDS.items():
        if freqs.size < 2:
            out[name] = 0.0
            continue
        mask = (freqs >= lo) & (freqs <= hi)
        out[name] = float(np.trapz(psd[mask], freqs[mask])) if np.any(mask) else 0.0
    return out


def theta_beta_ratio(signal: np.ndarray, fs: int) -> tuple[float, float, float]:
    """Return (ratio, theta_power, beta_power)."""
    powers = all_band_powers(signal, fs)
    theta = powers["theta"]
    beta = powers["beta"]
    ratio = theta / beta if beta > 1e-9 else 0.0
    return ratio, theta, beta


def rms(signal: np.ndarray) -> float:
    if signal.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(np.square(signal - np.mean(signal)))))


def noise_60hz_ratio(signal: np.ndarray, fs: int, mains: int = 60) -> float:
    """Power in mains band relative to total 1-50Hz power."""
    freqs, psd = compute_psd(signal, fs)
    if freqs.size < 2:
        return 0.0
    total_mask = (freqs >= 1.0) & (freqs <= 50.0)
    mains_mask = (freqs >= mains - 2) & (freqs <= mains + 2)
    total = float(np.trapz(psd[total_mask], freqs[total_mask])) if np.any(total_mask) else 0.0
    mains_p = float(np.trapz(psd[mains_mask], freqs[mains_mask])) if np.any(mains_mask) else 0.0
    if total < 1e-9:
        return 0.0
    return mains_p / total


def impedance_status(rms_val: float, noise_ratio: float, variance: float) -> str:
    """Classify electrode contact quality."""
    if variance < 1e-6:
        return "bad"
    if rms_val < 5.0 or rms_val > 200.0:
        return "bad"
    if noise_ratio > 0.5:
        return "bad"
    if rms_val < 10.0 or rms_val > 100.0 or noise_ratio > 0.25:
        return "marginal"
    return "good"


def sigmoid_score(value: float, mean: float, std: float, sensitivity: float = 0.3) -> float:
    """Lower theta/beta = better focus.

    z = -(value - mean) / std (negative because lower is better).
    """
    if std < 1e-6:
        std = 1e-6
    z = -(value - mean) / std
    try:
        return 1.0 / (1.0 + math.exp(-2.0 * (z - sensitivity)))
    except OverflowError:
        return 0.0 if z < 0 else 1.0
