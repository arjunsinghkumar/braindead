import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useSocket from "../hooks/useSocket.js";
import HeadDiagram from "../components/HeadDiagram.jsx";
import WaveformChart from "../components/WaveformChart.jsx";

const STATUS_TEXT = {
  good: { color: "text-good", label: "Good" },
  marginal: { color: "text-warn", label: "Marginal" },
  bad: { color: "text-bad", label: "Bad" },
  unknown: { color: "text-terminal-dim", label: "—" },
};

export default function ImpedancePage({ board }) {
  const { on, emit } = useSocket();
  const [results, setResults] = useState({});
  const [waveform, setWaveform] = useState({ channels: {}, fs: 200 });
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const offRaw = on("raw_eeg", (p) => setWaveform({ channels: p.channels, fs: p.fs }));
    const offRes = on("impedance_result", (p) => {
      setResults(p.results || {});
      setRunning(false);
    });
    const offErr = on("error", () => setRunning(false));
    return () => { offRaw(); offRes(); offErr(); };
  }, [on]);

  const start = () => {
    setResults({});
    setRunning(true);
    emit("start_impedance", { notch_hz: 60 });
  };
  const stop = () => { emit("stop_session"); setRunning(false); };

  const czGood = results.Cz?.status === "good";
  const channels = ["Cz", "C3", "C4"];

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stage 1 — Impedance Check</h1>
          <p className="text-terminal-dim text-sm font-terminal">
            Verify each electrode has good scalp contact before proceeding.
          </p>
        </div>
        <div className="flex gap-2">
          {running ? (
            <button className="btn-danger" onClick={stop}>Stop</button>
          ) : (
            <button className="btn-primary" onClick={start} disabled={!board?.connected}>
              {Object.keys(results).length ? "Retry Check" : "Run Check (5s)"}
            </button>
          )}
          <Link
            to="/alpha"
            className={`btn-primary ${czGood ? "" : "opacity-40 pointer-events-none"}`}
          >
            Continue to Alpha Test →
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-1">
          <h3 className="font-semibold mb-3">Electrode Map</h3>
          <HeadDiagram statuses={results} />
          <p className="text-xs text-terminal-dim mt-3 text-center font-terminal">
            Top-down view. A1/A2 are ear references.
          </p>
        </div>

        <div className="lg:col-span-2 grid sm:grid-cols-3 gap-3">
          {channels.map((label) => {
            const r = results[label];
            const st = STATUS_TEXT[r?.status || "unknown"];
            return (
              <div key={label} className="card">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold text-lg">{label}</h3>
                  <span className={`pill ${st.color}`}>● {st.label}</span>
                </div>
                <dl className="mt-3 text-xs space-y-1.5 font-mono">
                  <Row k="RMS (µV)" v={r?.rms?.toFixed(1) ?? "—"} />
                  <Row k="60Hz noise" v={r ? (r.noise_60hz * 100).toFixed(1) + "%" : "—"} />
                  <Row k="Variance" v={r?.variance?.toFixed(1) ?? "—"} />
                </dl>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">Live Waveform (1s window)</h3>
        <WaveformChart channels={waveform.channels} fs={waveform.fs} height={220} />
        {!running && Object.keys(waveform.channels).length === 0 && (
          <p className="text-xs text-terminal-dim mt-2 font-terminal">Press “Run Check” to stream live EEG.</p>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between">
      <span className="text-terminal-dim font-terminal">{k}</span>
      <span>{v}</span>
    </div>
  );
}
