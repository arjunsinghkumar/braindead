import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import useSocket from "../hooks/useSocket.js";
import useAudioFeedback from "../hooks/useAudioFeedback.js";
import FocusOrb from "../components/FocusOrb.jsx";
import ScoreBar from "../components/ScoreBar.jsx";
import BandPowerChart from "../components/BandPowerChart.jsx";

export default function FocusPage({ board }) {
  const { on, emit } = useSocket();

  const [duration, setDuration] = useState(5);
  const [sensitivity, setSensitivity] = useState(0.3);
  const [phase, setPhase] = useState("idle"); // idle / calibrating / training / done
  const [cal, setCal] = useState({ remaining: 0, theta_beta: 0 });
  const [score, setScore] = useState(0);
  const [thetaBeta, setThetaBeta] = useState(0);
  const [bands, setBands] = useState({ delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 });
  const [series, setSeries] = useState([]);
  const [remaining, setRemaining] = useState(0);
  const [savedSession, setSavedSession] = useState(null);

  const audio = useAudioFeedback(phase === "training");
  const lastScoreRef = useRef(0);

  useEffect(() => {
    const offCal = on("calibration", (p) => {
      setPhase(p.phase === "done" ? "training" : "calibrating");
      setCal({
        remaining: p.remaining || 0,
        theta_beta: p.theta_beta || 0,
        baseline_mean: p.baseline_mean,
        baseline_std: p.baseline_std,
      });
    });
    const offBands = on("band_powers", (p) => {
      setBands({
        delta: p.delta, theta: p.theta, alpha: p.alpha, beta: p.beta, gamma: p.gamma,
      });
      setThetaBeta(p.theta_beta || 0);
      setSeries((s) => [
        ...s.slice(-300),
        {
          t: Number((p.t || 0).toFixed(1)),
          delta: p.delta, theta: p.theta, alpha: p.alpha, beta: p.beta, gamma: p.gamma,
        },
      ]);
    });
    const offScore = on("score_update", (p) => {
      lastScoreRef.current = p.score;
      setScore(p.score);
      setRemaining(p.remaining || 0);
      audio.setScore(p.score);
    });
    const offSaved = on("session_saved", (p) => {
      setSavedSession(p.summary);
      setPhase("done");
    });
    const offErr = on("error", () => setPhase("idle"));
    return () => { offCal(); offBands(); offScore(); offSaved(); offErr(); };
  }, [on, audio]);

  const start = () => {
    setSeries([]); setSavedSession(null); setScore(0);
    setPhase("calibrating");
    emit("start_focus", {
      duration_min: duration,
      sensitivity,
      notch_hz: 60,
      calibration_sec: 30,
    });
  };
  const stop = () => { emit("stop_session"); setPhase("idle"); };

  const trainingActive = phase === "training";

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stage 3 — Focus Training</h1>
          <p className="text-slate-400 text-sm">
            Theta/beta neurofeedback at Cz (Lubar/Monastra protocol).
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {phase === "idle" || phase === "done" ? (
            <>
              <label className="text-xs text-slate-400 flex items-center gap-2">
                Duration
                <input
                  type="number" min={1} max={30} value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-16 bg-ink-700 px-2 py-1 rounded text-sm"
                /> min
              </label>
              <label className="text-xs text-slate-400 flex items-center gap-2">
                Sensitivity
                <input
                  type="number" step={0.1} min={-1} max={1} value={sensitivity}
                  onChange={(e) => setSensitivity(Number(e.target.value))}
                  className="w-16 bg-ink-700 px-2 py-1 rounded text-sm"
                />
              </label>
              <button className="btn-primary" onClick={start} disabled={!board?.connected}>
                Start
              </button>
            </>
          ) : (
            <button className="btn-danger" onClick={stop}>Stop</button>
          )}
        </div>
      </div>

      {phase === "calibrating" && (
        <div className="card text-center">
          <div className="text-xs uppercase text-slate-400 tracking-widest">Calibrating</div>
          <div className="text-xl mt-2">Sit still. Breathe normally.</div>
          <div className="text-5xl mt-4 font-mono">{cal.remaining.toFixed(0)}s</div>
          <div className="text-xs text-slate-400 mt-2 font-mono">
            current θ/β = {cal.theta_beta.toFixed(2)}
          </div>
        </div>
      )}

      {trainingActive && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="card lg:col-span-1 flex flex-col items-center justify-center min-h-[320px]">
            <FocusOrb score={score} />
            <div className="mt-8 w-full px-4">
              <ScoreBar score={score} />
            </div>
            <div className="mt-3 text-xs text-slate-400 font-mono">
              θ/β = {thetaBeta.toFixed(2)} · θ = {bands.theta.toFixed(1)}µV² · β = {bands.beta.toFixed(1)}µV²
            </div>
            <div className="mt-1 text-xs text-slate-400 font-mono">
              {Math.floor(remaining / 60)}m {Math.floor(remaining % 60)}s remaining
            </div>
          </div>
          <div className="card lg:col-span-2">
            <h3 className="font-semibold mb-3">Band Power (Cz)</h3>
            <BandPowerChart data={series} height={300} />
          </div>
        </div>
      )}

      {phase === "done" && savedSession && (
        <div className="card">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xl font-semibold">Session Complete · #{savedSession.id}</h2>
            <Link to={`/results?id=${savedSession.id}`} className="btn-primary">
              View Detailed Results →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Metric label="Avg score"
                    value={`${Math.round((savedSession.avg_score || 0) * 100)}%`} />
            <Metric label="Peak score"
                    value={`${Math.round((savedSession.peak_score || 0) * 100)}%`} />
            <Metric label="Avg θ/β" value={(savedSession.avg_theta_beta || 0).toFixed(2)} />
            <Metric label="Trend" value={savedSession.trend || "—"} />
            <Metric label="Time >50%"
                    value={`${Math.round(savedSession.time_above_50 || 0)}%`} />
            <Metric label="Time >75%"
                    value={`${Math.round(savedSession.time_above_75 || 0)}%`} />
            <Metric label="Duration" value={`${Math.round(savedSession.duration_sec)}s`} />
            <Metric label="Mode" value={savedSession.mode} />
          </div>
        </div>
      )}

      {phase === "idle" && !savedSession && (
        <div className="card">
          <h3 className="font-semibold mb-2">How it works</h3>
          <ol className="list-decimal list-inside text-sm text-slate-300 space-y-1">
            <li>30-second calibration measures your baseline theta/beta ratio at Cz.</li>
            <li>During training, score is computed every 250ms — lower θ/β = higher score.</li>
            <li>The orb glows and a tone gets louder when you're focused.</li>
            <li>Session is saved automatically when complete (or stopped early).</li>
          </ol>
          <p className="text-xs text-slate-500 mt-3">
            Reference: typical adult θ/β at Cz ~ 2.0–3.0; elevated values >3.5 are
            associated with ADHD in clinical literature, but this tool cannot diagnose.
          </p>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="bg-ink-700/60 rounded-lg p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="font-mono text-base mt-0.5">{value}</div>
    </div>
  );
}
