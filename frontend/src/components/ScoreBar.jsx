export default function ScoreBar({ score = 0, label = "Focus Score" }) {
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100);
  const color =
    pct >= 75 ? "bg-good" : pct >= 50 ? "bg-accent-500" : pct >= 25 ? "bg-warn" : "bg-bad";
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-300 mb-1">
        <span>{label}</span>
        <span className="font-mono">{pct}%</span>
      </div>
      <div className="w-full h-3 rounded-full bg-ink-700 overflow-hidden">
        <div
          className={`h-full transition-all duration-150 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
