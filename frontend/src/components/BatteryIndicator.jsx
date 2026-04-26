/**
 * Battery pill — colour scales from green → yellow → red.
 * Shows "—" when battery is unknown (board disconnected or no reading yet).
 */
export default function BatteryIndicator({ percent }) {
  const known = typeof percent === "number" && !isNaN(percent);
  const pct = known ? Math.max(0, Math.min(100, Math.round(percent))) : null;

  const color =
    pct == null ? "bg-slate-600/40 text-slate-300"
    : pct >= 60 ? "bg-good/20 text-good"
    : pct >= 25 ? "bg-warn/20 text-warn"
    : "bg-bad/20 text-bad";

  // SVG battery icon with fill width based on percent
  return (
    <span
      className={`pill gap-1.5 ${color}`}
      title={pct == null ? "Battery unknown" : `Ganglion battery ${pct}%`}
    >
      <svg width="16" height="10" viewBox="0 0 22 12" aria-hidden>
        <rect
          x="0.5" y="0.5" width="18" height="11"
          rx="2" ry="2"
          fill="none" stroke="currentColor" strokeWidth="1"
        />
        <rect x="19.5" y="3" width="2" height="6" fill="currentColor" />
        {pct != null && pct > 0 && (
          <rect
            x="2" y="2"
            width={Math.max(1, (pct / 100) * 15)}
            height="8"
            fill="currentColor"
          />
        )}
      </svg>
      {pct != null ? `${pct}%` : "—"}
    </span>
  );
}
