import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import useSocket from "../hooks/useSocket.js";

const PHASE_COPY = {
  eyes_open: { title: "Eyes OPEN", desc: "Look at the fixation cross. Stay still." },
  eyes_closed: { title: "Eyes CLOSED", desc: "Close your eyes. Relax. A tone will sound when it's time to open them." },
  eyes_open_2: { title: "Eyes OPEN", desc: "Open your eyes. Look at the cross again." },
  done: { title: "Done", desc: "Computing alpha ratio…" },
};

export default function AlphaTestPage({ board }) {
  const { on, emit } = useSocket();
  const [phase, setPhase] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [series, setSeries] = useState([]);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const offPhase = on("alpha_test_phase", (p) => {
      setPhase(p.phase);
      setRemaining(p.remaining);
      if (p.alpha != null) {
        setSeries((s) => [...s.slice(-200), { t: s.length, alpha: p.alpha, phase: p.phase }]);
      }
    });
    const offRes = on("alpha_test_result", (p) => {
      setResult(p);
      setRunning(false);
    });
    const offErr = on("error", () => setRunning(false));
    return () => { offPhase(); offRes(); offErr(); };
  }, [on]);

  // beep on phase changes (eyes_closed -> eyes_open_2 transition)
  useEffect(() => {
    if (phase === "eyes_open_2") beep();
  }, [phase]);

  const start = () => {
    setSeries([]); setResult(null);
    setRunning(true);
    emit("start_alpha_test", { notch_hz: 60 });
  };
  const stop = () => { emit("stop_session"); setRunning(false); };

  const copy = phase ? PHASE_COPY[phase] : null;
  const passed = result?.result === "pass";

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stage 2 — Eyes-Closed Alpha</h1>
          <p className="text-slate-400 text-sm">
            Verify electrodes detect real EEG via the alpha blocking response.
          </p>
        </div>
        <div className="flex gap-2">
          {running ? (
            <button className="btn-danger" onClick={stop}>Stop</button>
          ) : (
            <button className="btn-primary" onClick={start} disabled={!board?.connected}>
              {result ? "Run Again" : "Start Test (~60s)"}
            </button>
          )}
          <Link
            to="/focus"
            className={`btn-primary ${result?.result !== "fail" && result ? "" : "opacity-40 pointer-events-none"}`}
          >
            Continue to Focus Training →
          </Link>
        </div>
      </div>

      {(running || phase) && (
        <div className="card text-center">
          <div className="text-xs uppercase text-slate-400 tracking-widest">
            {copy?.title || ""}
          </div>
          <div className="text-7xl my-4 font-mono">⊕</div>
          <div className="text-xl">{copy?.desc}</div>
          {remaining > 0 && (
            <div className="text-3xl mt-4 font-mono">{remaining.toFixed(0)}s</div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold mb-3">Live Alpha Power (Cz)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={series}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis dataKey="t" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ background: "#0b0f17", border: "1px solid #1f2937" }} />
              <Line type="monotone" dataKey="alpha" stroke="#22c55e" dot={false} strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-3">Eyes-Open vs Eyes-Closed</h3>
          {result ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={[
                  { name: "Open", power: Number(result.eyes_open_alpha.toFixed(3)) },
                  { name: "Closed", power: Number(result.eyes_closed_alpha.toFixed(3)) },
                ]}
              >
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ background: "#0b0f17", border: "1px solid #1f2937" }} />
                <Bar dataKey="power" fill="#38bdf8" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-slate-400 text-center py-16">
              Results will appear here after the test completes.
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className={`card ${
          result.result === "pass" ? "border-good/60 bg-good/5"
          : result.result === "marginal" ? "border-warn/60 bg-warn/5"
          : "border-bad/60 bg-bad/5"
        }`}>
          <div className="flex items-baseline justify-between">
            <h3 className="font-semibold text-lg">
              Result: <span className="uppercase">{result.result}</span>
            </h3>
            <span className="font-mono">
              ratio = {result.ratio.toFixed(2)} (closed / open)
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            {result.result === "pass" && "Clear alpha blocking response detected — electrodes working well."}
            {result.result === "marginal" && "Weak alpha response — consider reseating Cz electrode."}
            {result.result === "fail" && "No alpha response detected. Recheck electrode contact and try again."}
          </p>
        </div>
      )}
    </div>
  );
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = 660;
    osc.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {}
}
