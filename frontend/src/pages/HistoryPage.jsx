import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import HistoryChart from "../components/HistoryChart.jsx";

export default function HistoryPage() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);

  const load = () => {
    fetch("/api/sessions?per_page=50").then((r) => r.json()).then((d) => setItems(d.items || []));
    fetch("/api/stats").then((r) => r.json()).then(setStats);
  };
  useEffect(load, []);

  const focus = items.filter((x) => x.mode === "focus");

  const del = async (id) => {
    if (!confirm(`Delete session #${id}?`)) return;
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Session History</h1>

      <div className="card">
        <h3 className="font-semibold mb-3">
          Focus Sessions Trend ({stats?.count || 0})
        </h3>
        {stats?.focus_sessions?.length ? (
          <HistoryChart sessions={stats.focus_sessions} />
        ) : (
          <p className="text-sm text-slate-400">No focus sessions yet.</p>
        )}
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">All Sessions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 text-xs uppercase">
              <tr>
                <th className="text-left py-2">#</th>
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Mode</th>
                <th className="text-right py-2">Duration</th>
                <th className="text-right py-2">Avg score</th>
                <th className="text-right py-2">θ/β</th>
                <th className="text-left py-2">Trend</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-t border-ink-700">
                  <td className="py-2 font-mono">{s.id}</td>
                  <td className="py-2">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="py-2">{s.mode}</td>
                  <td className="py-2 text-right font-mono">
                    {s.duration_sec ? `${Math.round(s.duration_sec)}s` : "—"}
                  </td>
                  <td className="py-2 text-right font-mono">
                    {s.avg_score != null ? `${Math.round(s.avg_score * 100)}%` : "—"}
                  </td>
                  <td className="py-2 text-right font-mono">
                    {s.avg_theta_beta != null ? s.avg_theta_beta.toFixed(2) : "—"}
                  </td>
                  <td className="py-2">{s.trend || "—"}</td>
                  <td className="py-2 text-right">
                    {s.mode === "focus" && (
                      <Link to={`/results?id=${s.id}`} className="text-accent-400 hover:underline mr-2">
                        view
                      </Link>
                    )}
                    <button onClick={() => del(s.id)} className="text-bad hover:underline text-xs">
                      delete
                    </button>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
                    No sessions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
