# NeuroFlow — OpenBCI Ganglion Neurofeedback Web App

A full-stack neurofeedback web app that connects directly to an OpenBCI Ganglion
(no OpenBCI GUI needed), runs a 3-stage EEG assessment pipeline, and provides
real-time neurofeedback training with session persistence.

> **Educational tool — not a medical device.** Theta/beta ratio measurements
> cannot diagnose ADHD or any clinical condition.

---

## Hardware

- **Board:** OpenBCI Ganglion (4 ch, 200 Hz, BLE via BLED112 dongle)
- **Montage** (3 scalp + 2 ear refs):
  | Lead | Position |
  |---|---|
  | Ch 1 (+1, grey) | **Cz** — vertex / midline (primary θ/β site) |
  | Ch 2 (+2, purple) | **C3** — left motor cortex (inattentive SMR) |
  | Ch 3 (+3, blue) | **C4** — right motor cortex (hyperactive SMR) |
  | Ch 4 (+4, green) | spare / EOG |
  | REF (yellow) | A1 — left earlobe |
  | D_G (black) | A2 — right earlobe |
- All 4 DIP switches **DOWN** (monopolar against shared REF).

## Architecture

```
Browser (React + Recharts + Web Audio)
       ↕ Socket.IO
Python (Flask · Flask-SocketIO · BrainFlow · SQLAlchemy/SQLite)
       ↕ BLE (BLED112)
OpenBCI Ganglion
```

BrainFlow runs **server-side only** — Python acquires/filters EEG, the browser
receives processed metrics over WebSocket and renders them.

## 3-Stage Pipeline

1. **Impedance check** — 5 s of streaming, traffic-light per channel based on
   RMS µV, 60 Hz noise ratio, and variance.
2. **Eyes-closed alpha verification** — 15 s open / 30 s closed / 15 s open;
   computes alpha-blocking ratio (`pass` >1.5, `marginal` 1.2–1.5, `fail` <1.2).
3. **ADHD focus training** — 30 s calibration → configurable training (default
   5 min) with sigmoid scoring on θ/β at Cz, audio orb feedback, auto-saved.

DSP: detrend → 1–50 Hz bandpass → notch (60 Hz default, configurable for 50)
→ Welch PSD with Hanning window → band integration over δ/θ/α/β/γ.

## Database

SQLite (`backend/neuroflow.db`, auto-created). Tables:
`sessions`, `session_samples`, `impedance_checks`, `alpha_tests`.

## Running it

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate         # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
python app.py                     # → http://localhost:5000
```

### Frontend (dev)

```bash
cd frontend
npm install
npm run dev                       # → http://localhost:5173 (proxies /api & /socket.io to :5000)
```

### Frontend (production build)

```bash
cd frontend
npm run build                     # → frontend/dist
# Then re-run `python app.py` — Flask will serve dist/ at /
```

## Desktop app (Electron)

This repo includes a lightweight Electron wrapper in `desktop/` so you can run the UI
as a desktop window while you iterate.

### Dev mode (fast iteration)

Start backend + frontend as usual, then open the Vite URL inside Electron:

```bash
cd backend
source .venv/bin/activate
PORT=5001 python app.py
```

```bash
cd frontend
npx vite --host 127.0.0.1 --port 5173
```

```bash
cd desktop
npm install
npm run dev
```

### “Prod-ish” mode (serves `frontend/dist` from Flask)

Build the frontend, run Flask, then open it inside Electron:

```bash
cd frontend
npm run build
cd ../backend
source .venv/bin/activate
PORT=5001 python app.py
cd ../desktop
npm run start
```

## Configuration

- `NEUROFLOW_DB` — override SQLite path (default `backend/neuroflow.db`).
- `PORT` — Flask port (default `5000`).
- Mains notch (60/50 Hz) — toggle in the per-stage start payloads (currently 60).

## Sockets

| Event (server → client) | Payload |
|---|---|
| `board_status` | `{connected, board_name, sampling_rate, …}` |
| `battery_status` | `{percent}` (0-100, or null when unknown — emitted every 10 s while connected) |
| `raw_eeg` | `{ts, fs, channels: {Cz: [...], C3: [...], C4: [...]}}` |
| `impedance_result` | `{session_id, results: {Cz/C3/C4: {rms, noise_60hz, status}}}` |
| `alpha_test_phase` | `{phase, remaining, alpha?, bands?}` |
| `alpha_test_result` | `{eyes_open_alpha, eyes_closed_alpha, ratio, result}` |
| `calibration` | `{phase, remaining, theta_beta, baseline_mean?, baseline_std?}` |
| `band_powers` | `{t, channel, delta, theta, alpha, beta, gamma, theta_beta, aux}` |
| `score_update` | `{t, score, theta_beta, elapsed, remaining, phase}` |
| `session_saved` | `{session_id, summary}` |
| `error` | `{message}` |

| Event (client → server) | Payload |
|---|---|
| `connect_board` | `{serial_port}` (BLED112 device path) |
| `disconnect_board` | `{}` |
| `start_impedance` | `{notch_hz?}` |
| `start_alpha_test` | `{notch_hz?}` |
| `start_focus` | `{duration_min?, sensitivity?, notch_hz?, calibration_sec?}` |
| `stop_session` | `{}` |

## REST

- `GET /api/health`
- `GET /api/board/status`
- `GET /api/board/ports` — list candidate BLED112 serial ports
- `GET /api/board/battery` — `{percent}` from the Ganglion (null if unknown)
- `GET /api/sessions?page=&per_page=&mode=`
- `GET /api/sessions/latest`
- `GET /api/sessions/<id>` (includes samples + sub-tables)
- `DELETE /api/sessions/<id>`
- `GET /api/stats` (focus session series)

## Connecting to the Ganglion

1. Plug the BLED112 USB dongle into the host machine.
2. Power the Ganglion (battery on, blue LED).
3. Open `http://localhost:5173` (dev) or `http://localhost:5000` (built).
4. The **Connect** page auto-scans for serial ports
   (`/dev/cu.usbmodem*` on macOS, `/dev/ttyACM*` on Linux, `COM*` on Windows).
   Pick the BLED112 entry and click **Pair & Connect** — BrainFlow performs
   the BLE discovery + pairing inside `prepare_session()`.

If pairing fails, common fixes:
- macOS: grant the terminal Bluetooth permission in System Settings.
- Linux: ensure your user is in the `dialout` group, then re-login.
- Windows: confirm the BLED112 enumerated as a COM port in Device Manager.
- Make sure no other process (OpenBCI GUI, BrainFlow script) holds the dongle.

## Project layout

```
backend/
  app.py                Flask + Socket.IO entry
  board_manager.py      BrainFlow Ganglion wrapper (BLE pair + stream)
  signal_processor.py   DSP (filters, PSD, band powers, scoring)
  pipeline.py           Stage 1/2/3 runners
  models.py             SQLAlchemy models + DB session
  requirements.txt
frontend/
  src/
    App.jsx                 router
    components/             Layout, ConnectionPanel, HeadDiagram, WaveformChart,
                            BandPowerChart, FocusOrb, ScoreBar, SessionCard,
                            HistoryChart
    pages/                  ConnectPage, ImpedancePage, AlphaTestPage,
                            FocusPage, ResultsPage, HistoryPage
    hooks/                  useSocket, useAudioFeedback
    utils/audioEngine.js    Web Audio tone generator
  package.json
  vite.config.js
  tailwind.config.js
```

## Notes & references

- Lubar/Monastra theta/beta protocol at Cz; reference adult θ/β ≈ 2.0–3.0,
  elevated values (>3.5) historically associated with ADHD in literature.
- This project uses BrainFlow for cross-platform Ganglion access — no OpenBCI
  GUI or LSL stream required.
