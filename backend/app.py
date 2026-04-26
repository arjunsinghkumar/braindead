"""NeuroFlow Flask + Socket.IO entry point."""
from __future__ import annotations
import os
import sys
import threading
from pathlib import Path

# Use eventlet for async Socket.IO if available.
# On macOS, eventlet + kqueue is a common source of runtime issues, so default
# to the more portable threading mode.
if sys.platform == "darwin":
    ASYNC_MODE = "threading"
else:
    try:
        import eventlet  # type: ignore

        eventlet.monkey_patch()
        ASYNC_MODE = "eventlet"
    except Exception:  # pragma: no cover
        ASYNC_MODE = "threading"

from flask import Flask, jsonify, request, send_from_directory, abort
from flask_cors import CORS
from flask_socketio import SocketIO, emit

from board_manager import BoardManager, list_serial_ports
from models import init_db, get_db, Session
import pipeline

# --------------------------------------------------------------------------
# app setup
# --------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent
FRONTEND_DIST = ROOT.parent / "frontend" / "dist"
DB_PATH = os.environ.get("NEUROFLOW_DB", str(ROOT / "neuroflow.db"))

app = Flask(
    __name__,
    static_folder=str(FRONTEND_DIST) if FRONTEND_DIST.exists() else None,
    static_url_path="",
)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "neuroflow-dev-secret")
CORS(app, resources={r"/api/*": {"origins": "*"}})

socketio = SocketIO(
    app,
    async_mode=ASYNC_MODE,
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

init_db(DB_PATH)
board = BoardManager()

# in-memory pipeline state
_session_lock = threading.Lock()
_active_thread: threading.Thread | None = None
_stop_event = threading.Event()

# battery-poll thread state
_battery_thread: threading.Thread | None = None
_battery_stop = threading.Event()


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def _emit(event: str, payload: dict):
    """Emit to all connected clients (thread-safe via socketio.emit)."""
    socketio.emit(event, payload)


def _start_thread(target, *args, **kwargs):
    global _active_thread, _stop_event
    with _session_lock:
        if _active_thread and _active_thread.is_alive():
            _stop_event.set()
            _active_thread.join(timeout=2.0)
        _stop_event = threading.Event()
        kwargs["stop_event"] = _stop_event
        _active_thread = threading.Thread(
            target=target, args=args, kwargs=kwargs, daemon=True,
        )
        _active_thread.start()


def _stop_thread():
    global _active_thread
    with _session_lock:
        if _active_thread and _active_thread.is_alive():
            _stop_event.set()
            _active_thread.join(timeout=3.0)
        _active_thread = None


def _battery_loop():
    """Emit battery_status every 10s while the board is connected."""
    while not _battery_stop.is_set():
        if board.connected:
            pct = board.get_battery_percent()
            socketio.emit("battery_status", {"percent": pct})
        socketio.sleep(10)


def _start_battery_poller():
    global _battery_thread, _battery_stop
    if _battery_thread and _battery_thread.is_alive():
        return
    _battery_stop = threading.Event()
    _battery_thread = socketio.start_background_task(_battery_loop)


def _stop_battery_poller():
    global _battery_thread
    _battery_stop.set()
    _battery_thread = None


# --------------------------------------------------------------------------
# REST endpoints
# --------------------------------------------------------------------------

@app.route("/api/health")
def health():
    return jsonify({"ok": True, "async_mode": ASYNC_MODE})


@app.route("/api/board/status")
def board_status():
    return jsonify(board.status())


@app.route("/api/board/ports")
def board_ports():
    return jsonify({"ports": list_serial_ports()})


@app.route("/api/board/battery")
def board_battery():
    return jsonify({"percent": board.get_battery_percent()})


@app.route("/api/sessions")
def list_sessions():
    db = get_db()
    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(max(int(request.args.get("per_page", 50)), 1), 200)
    mode = request.args.get("mode")

    q = db.query(Session).order_by(Session.created_at.desc())
    if mode:
        q = q.filter(Session.mode == mode)
    total = q.count()
    rows = q.offset((page - 1) * per_page).limit(per_page).all()
    return jsonify({
        "total": total, "page": page, "per_page": per_page,
        "items": [r.to_dict() for r in rows],
    })


@app.route("/api/sessions/latest")
def latest_sessions():
    db = get_db()
    out = {}
    for mode in ("impedance", "alpha", "focus"):
        row = (db.query(Session)
               .filter(Session.mode == mode)
               .order_by(Session.created_at.desc())
               .first())
        out[mode] = row.to_dict(include_samples=True) if row else None
    return jsonify(out)


@app.route("/api/sessions/<int:sid>")
def get_session(sid: int):
    db = get_db()
    row = db.get(Session, sid)
    if not row:
        abort(404)
    return jsonify(row.to_dict(include_samples=True))


@app.route("/api/sessions/<int:sid>", methods=["DELETE"])
def delete_session(sid: int):
    db = get_db()
    row = db.get(Session, sid)
    if not row:
        abort(404)
    db.delete(row)
    db.commit()
    return jsonify({"deleted": sid})


@app.route("/api/stats")
def stats():
    db = get_db()
    rows = (db.query(Session)
            .filter(Session.mode == "focus")
            .order_by(Session.created_at.asc())
            .all())
    series = [{
        "id": r.id,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "avg_score": r.avg_score, "peak_score": r.peak_score,
        "avg_theta_beta": r.avg_theta_beta, "trend": r.trend,
        "duration_sec": r.duration_sec,
    } for r in rows]
    return jsonify({"focus_sessions": series, "count": len(series)})


# --------------------------------------------------------------------------
# Static / SPA fallback
# --------------------------------------------------------------------------

@app.route("/")
@app.route("/<path:path>")
def serve_spa(path: str = ""):
    if not FRONTEND_DIST.exists():
        return jsonify({
            "msg": "NeuroFlow API running. Build the frontend (npm run build) "
                   "or use the dev server at http://localhost:5173",
            "endpoints": ["/api/health", "/api/sessions", "/api/board/status"],
        })
    target = FRONTEND_DIST / path
    if path and target.exists() and target.is_file():
        return send_from_directory(str(FRONTEND_DIST), path)
    return send_from_directory(str(FRONTEND_DIST), "index.html")


# --------------------------------------------------------------------------
# Socket.IO events
# --------------------------------------------------------------------------

@socketio.on("connect")
def handle_connect():
    emit("board_status", board.status())


@socketio.on("connect_board")
def handle_connect_board(data):
    serial_port = (data or {}).get("serial_port")
    if not serial_port:
        emit("error", {"message": "Serial port required (BLED112 dongle)."})
        return
    try:
        status = board.connect(serial_port=serial_port)
        emit("board_status", status, broadcast=True)
        _start_battery_poller()
        # send an immediate battery reading so the UI doesn't wait 10s
        socketio.emit("battery_status", {"percent": board.get_battery_percent()})
    except Exception as e:  # pragma: no cover
        emit("error", {"message": f"Connect failed: {e}"})


@socketio.on("disconnect_board")
def handle_disconnect_board(_=None):
    _stop_thread()
    _stop_battery_poller()
    board.disconnect()
    emit("board_status", board.status(), broadcast=True)
    socketio.emit("battery_status", {"percent": None})


@socketio.on("start_impedance")
def handle_start_impedance(data=None):
    if not board.connected:
        emit("error", {"message": "Connect to a board first."})
        return
    notch = int((data or {}).get("notch_hz", 60))
    _start_thread(
        pipeline.run_impedance_check,
        board, _emit,
        notch_hz=notch,
    )


@socketio.on("start_alpha_test")
def handle_start_alpha(data=None):
    if not board.connected:
        emit("error", {"message": "Connect to a board first."})
        return
    notch = int((data or {}).get("notch_hz", 60))
    _start_thread(
        pipeline.run_alpha_test,
        board, _emit,
        notch_hz=notch,
    )


@socketio.on("start_focus")
def handle_start_focus(data=None):
    if not board.connected:
        emit("error", {"message": "Connect to a board first."})
        return
    payload = data or {}
    duration = float(payload.get("duration_min", 5.0))
    sensitivity = float(payload.get("sensitivity", 0.3))
    notch = int(payload.get("notch_hz", 60))
    calib = float(payload.get("calibration_sec", 30.0))
    _start_thread(
        pipeline.run_focus_training,
        board, _emit,
        duration_min=duration,
        sensitivity=sensitivity,
        notch_hz=notch,
        calibration_sec=calib,
    )


@socketio.on("stop_session")
def handle_stop_session(_=None):
    _stop_thread()
    emit("board_status", board.status(), broadcast=True)


@socketio.on("disconnect")
def handle_disconnect():
    pass


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"[NeuroFlow] starting on :{port} (async={ASYNC_MODE}, db={DB_PATH})")
    socketio.run(app, host="0.0.0.0", port=port, debug=False, allow_unsafe_werkzeug=True)
