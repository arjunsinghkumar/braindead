"""3-stage pipeline runners (impedance / alpha verify / focus training).

Each runner is started in a background thread and emits Socket.IO events via
the provided emit() callable.  All long-running loops respect `stop_event`.
"""
from __future__ import annotations
import json
import math
import time
import threading
from collections import deque
from typing import Callable
import numpy as np

from board_manager import BoardManager, ACTIVE_CHANNELS
from signal_processor import (
    preprocess, all_band_powers, theta_beta_ratio, rms,
    noise_60hz_ratio, impedance_status, sigmoid_score, BANDS,
)
from models import (
    get_db, Session, SessionSample, ImpedanceCheck, AlphaTest,
)

EmitFn = Callable[[str, dict], None]


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def _safe_emit(emit: EmitFn, event: str, payload: dict):
    try:
        emit(event, payload)
    except Exception:
        pass


def _trend(values: list[float]) -> str:
    if len(values) < 8:
        return "too_short"
    half = len(values) // 2
    a = float(np.mean(values[:half]))
    b = float(np.mean(values[half:]))
    diff = b - a
    rng = max(abs(a), abs(b), 1e-6)
    pct = diff / rng
    if pct > 0.1:
        return "improving"
    if pct < -0.1:
        return "declining"
    return "stable"


# --------------------------------------------------------------------------
# Stage 1 — impedance / signal quality check
# --------------------------------------------------------------------------

def run_impedance_check(
    board: BoardManager,
    emit: EmitFn,
    stop_event: threading.Event,
    notch_hz: int = 60,
    duration_sec: float = 5.0,
    waveform_hz: float = 8.0,
):
    """Stream ~5 s of data, emit raw waveform updates, then summarize.

    Saves a Session row of mode='impedance' plus per-channel ImpedanceCheck rows.
    """
    if not board.connected:
        _safe_emit(emit, "error", {"message": "Board not connected"})
        return

    fs = board.sampling_rate or 200
    board.pop_all_data()  # discard stale ring buffer

    t0 = time.time()
    interval = 1.0 / waveform_hz
    while not stop_event.is_set() and (time.time() - t0) < duration_sec:
        win = board.get_eeg_window(1.0)
        if win:
            payload = {
                "ts": time.time(),
                "fs": fs,
                "channels": {
                    label: arr[-min(len(arr), int(fs)):].tolist()
                    for label, arr in win.items()
                },
            }
            _safe_emit(emit, "raw_eeg", payload)
        time.sleep(interval)

    # Collect a fresh 5-second window for the final analysis
    final = board.get_eeg_window(min(duration_sec, 5.0))
    results = {}
    db = get_db()
    sess = Session(mode="impedance", duration_sec=duration_sec)
    db.add(sess)
    db.flush()

    if final:
        for label in ACTIVE_CHANNELS:
            arr = final.get(label)
            if arr is None or arr.size == 0:
                results[label] = {
                    "rms": 0.0, "noise_60hz": 0.0,
                    "variance": 0.0, "status": "bad",
                }
                continue
            filtered = preprocess(arr, fs, notch_hz=notch_hz)
            r = rms(filtered)
            noise = noise_60hz_ratio(filtered, fs, mains=notch_hz)
            var = float(np.var(filtered))
            status = impedance_status(r, noise, var)
            results[label] = {
                "rms": r, "noise_60hz": noise,
                "variance": var, "status": status,
            }
            db.add(ImpedanceCheck(
                session_id=sess.id, channel_name=label,
                rms_uv=r, noise_60hz=noise, status=status,
            ))

    sess.meta = json.dumps({"results": results, "notch_hz": notch_hz})
    db.commit()

    _safe_emit(emit, "impedance_result", {
        "session_id": sess.id,
        "results": results,
    })


# --------------------------------------------------------------------------
# Stage 2 — eyes-closed alpha verification
# --------------------------------------------------------------------------

def _avg_alpha(board: BoardManager, fs: int, seconds: float, emit: EmitFn,
               phase: str, stop_event: threading.Event, notch_hz: int) -> float:
    """Run for `seconds`, emitting countdown + live alpha; return average alpha at Cz."""
    samples: list[float] = []
    t0 = time.time()
    last = 0.0
    while not stop_event.is_set() and (time.time() - t0) < seconds:
        remaining = max(0.0, seconds - (time.time() - t0))
        now = time.time()
        if now - last > 0.25:  # 4Hz update
            win = board.get_eeg_window(2.0)
            if win and "Cz" in win:
                cz = preprocess(win["Cz"], fs, notch_hz=notch_hz)
                bp = all_band_powers(cz, fs)
                samples.append(bp["alpha"])
                _safe_emit(emit, "alpha_test_phase", {
                    "phase": phase, "remaining": round(remaining, 1),
                    "alpha": bp["alpha"], "bands": bp,
                })
            last = now
        time.sleep(0.05)
    return float(np.mean(samples)) if samples else 0.0


def run_alpha_test(
    board: BoardManager,
    emit: EmitFn,
    stop_event: threading.Event,
    notch_hz: int = 60,
    open_sec: float = 15.0,
    closed_sec: float = 30.0,
):
    if not board.connected:
        _safe_emit(emit, "error", {"message": "Board not connected"})
        return

    fs = board.sampling_rate or 200
    board.pop_all_data()

    _safe_emit(emit, "alpha_test_phase", {"phase": "eyes_open", "remaining": open_sec})
    open_alpha = _avg_alpha(board, fs, open_sec, emit, "eyes_open", stop_event, notch_hz)
    if stop_event.is_set():
        return

    _safe_emit(emit, "alpha_test_phase", {"phase": "eyes_closed", "remaining": closed_sec})
    closed_alpha = _avg_alpha(board, fs, closed_sec, emit, "eyes_closed", stop_event, notch_hz)
    if stop_event.is_set():
        return

    _safe_emit(emit, "alpha_test_phase", {"phase": "eyes_open_2", "remaining": open_sec})
    open_alpha_2 = _avg_alpha(board, fs, open_sec, emit, "eyes_open_2", stop_event, notch_hz)

    open_combined = (open_alpha + open_alpha_2) / 2.0 if open_alpha_2 else open_alpha
    ratio = closed_alpha / open_combined if open_combined > 1e-9 else 0.0
    if ratio > 1.5:
        result = "pass"
    elif ratio > 1.2:
        result = "marginal"
    else:
        result = "fail"

    db = get_db()
    sess = Session(
        mode="alpha",
        duration_sec=open_sec * 2 + closed_sec,
        meta=json.dumps({
            "eyes_open_alpha": open_combined,
            "eyes_closed_alpha": closed_alpha,
            "alpha_ratio": ratio,
            "result": result,
            "notch_hz": notch_hz,
        }),
    )
    db.add(sess)
    db.flush()
    db.add(AlphaTest(
        session_id=sess.id,
        eyes_open_alpha=open_combined,
        eyes_closed_alpha=closed_alpha,
        alpha_ratio=ratio,
        result=result,
    ))
    db.commit()

    _safe_emit(emit, "alpha_test_phase", {"phase": "done", "remaining": 0})
    _safe_emit(emit, "alpha_test_result", {
        "session_id": sess.id,
        "eyes_open_alpha": open_combined,
        "eyes_closed_alpha": closed_alpha,
        "ratio": ratio,
        "result": result,
    })


# --------------------------------------------------------------------------
# Stage 3 — ADHD focus training
# --------------------------------------------------------------------------

def run_focus_training(
    board: BoardManager,
    emit: EmitFn,
    stop_event: threading.Event,
    duration_min: float = 5.0,
    sensitivity: float = 0.3,
    notch_hz: int = 60,
    calibration_sec: float = 30.0,
):
    if not board.connected:
        _safe_emit(emit, "error", {"message": "Board not connected"})
        return

    fs = board.sampling_rate or 200
    board.pop_all_data()

    # ---------- calibration ----------
    cal_ratios: list[float] = []
    t0 = time.time()
    last = 0.0
    while not stop_event.is_set() and (time.time() - t0) < calibration_sec:
        remaining = max(0.0, calibration_sec - (time.time() - t0))
        now = time.time()
        if now - last > 0.25:
            win = board.get_eeg_window(2.0)
            if win and "Cz" in win:
                cz = preprocess(win["Cz"], fs, notch_hz=notch_hz)
                ratio, theta, beta = theta_beta_ratio(cz, fs)
                if ratio > 0:
                    cal_ratios.append(ratio)
                _safe_emit(emit, "calibration", {
                    "phase": "calibrating",
                    "remaining": round(remaining, 1),
                    "theta_beta": ratio,
                })
            last = now
        time.sleep(0.05)

    if stop_event.is_set():
        return

    if cal_ratios:
        baseline_mean = float(np.mean(cal_ratios))
        baseline_std = float(np.std(cal_ratios)) or 0.5
    else:
        baseline_mean = 2.5
        baseline_std = 0.5

    _safe_emit(emit, "calibration", {
        "phase": "done", "remaining": 0,
        "baseline_mean": baseline_mean, "baseline_std": baseline_std,
    })

    # ---------- training ----------
    duration_sec = duration_min * 60.0
    db = get_db()
    sess = Session(mode="focus", duration_sec=duration_sec)
    db.add(sess)
    db.flush()
    sess_id = sess.id

    scores: list[float] = []
    ratios: list[float] = []
    t0 = time.time()
    last_emit = 0.0
    sample_buffer: list[SessionSample] = []

    while not stop_event.is_set() and (time.time() - t0) < duration_sec:
        now = time.time()
        if now - last_emit > 0.25:  # 4Hz
            win = board.get_eeg_window(2.0)
            if win and "Cz" in win:
                t_rel = now - t0
                cz = preprocess(win["Cz"], fs, notch_hz=notch_hz)
                bp = all_band_powers(cz, fs)
                ratio = bp["theta"] / bp["beta"] if bp["beta"] > 1e-9 else 0.0
                score = sigmoid_score(ratio, baseline_mean, baseline_std, sensitivity)

                ratios.append(ratio)
                scores.append(score)

                sample_buffer.append(SessionSample(
                    session_id=sess_id, t=t_rel,
                    delta=bp["delta"], theta=bp["theta"],
                    alpha=bp["alpha"], beta=bp["beta"], gamma=bp["gamma"],
                    theta_beta=ratio, score=score, channel="Cz",
                ))

                # Supplementary C3/C4 SMR-band powers for the dashboard
                aux = {}
                for label in ("C3", "C4"):
                    if label in win:
                        s2 = preprocess(win[label], fs, notch_hz=notch_hz)
                        aux[label] = all_band_powers(s2, fs)

                _safe_emit(emit, "band_powers", {
                    "t": t_rel, "channel": "Cz", **bp,
                    "theta_beta": ratio, "aux": aux,
                })
                _safe_emit(emit, "score_update", {
                    "t": t_rel,
                    "score": score,
                    "theta_beta": ratio,
                    "elapsed": t_rel,
                    "remaining": max(0.0, duration_sec - t_rel),
                    "phase": "training",
                })

                # Flush samples in chunks
                if len(sample_buffer) >= 40:
                    db.add_all(sample_buffer)
                    db.commit()
                    sample_buffer = []
            last_emit = now
        time.sleep(0.05)

    if sample_buffer:
        db.add_all(sample_buffer)
        db.commit()

    # ---------- summary ----------
    elapsed = time.time() - t0
    if scores:
        avg_score = float(np.mean(scores))
        peak_score = float(np.max(scores))
        time_above_50 = float(np.mean([1.0 if s >= 0.5 else 0.0 for s in scores])) * 100.0
        time_above_75 = float(np.mean([1.0 if s >= 0.75 else 0.0 for s in scores])) * 100.0
    else:
        avg_score = peak_score = time_above_50 = time_above_75 = 0.0

    avg_tb = float(np.mean(ratios)) if ratios else 0.0
    trend = _trend(scores)

    sess.duration_sec = elapsed
    sess.avg_score = avg_score
    sess.peak_score = peak_score
    sess.avg_theta_beta = avg_tb
    sess.time_above_50 = time_above_50
    sess.time_above_75 = time_above_75
    sess.trend = trend
    sess.meta = json.dumps({
        "baseline_mean": baseline_mean,
        "baseline_std": baseline_std,
        "sensitivity": sensitivity,
        "duration_min": duration_min,
        "notch_hz": notch_hz,
    })
    db.commit()

    _safe_emit(emit, "session_saved", {
        "session_id": sess_id,
        "summary": sess.to_dict(include_samples=False),
    })
