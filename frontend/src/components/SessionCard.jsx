export default function SessionCard({ session }) {
  if (!session) return null;
  const pct = (v) => (v == null ? "—" : `${Math.round(v)}%`);
  const num = (v, d = 2) => (v == null ? "—" : Number(v).toFixed(d));
  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold">Session #{session.id}</h3>
        <span className="text-xs text-slate-400">
          {new Date(session.created_at).toLocaleString()}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Metric label="Avg score" value={pct(session.avg_score * 100)} />
        <Metric label="Peak score" value={pct(session.peak_score * 100)} />
        <Metric label="Avg θ/β" value={num(session.avg_theta_beta)} />
        <Metric label="Trend" value={session.trend || "—"} />
        <Metric label="Time >50%" value={pct(session.time_above_50)} />
        <Metric label="Time >75%" value={pct(session.time_above_75)} />
        <Metric label="Duration" value={`${num(session.duration_sec, 0)}s`} />
        <Metric label="Mode" value={session.mode} />
      </div>
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
