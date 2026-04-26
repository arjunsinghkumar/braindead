import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import SessionCard from "../components/SessionCard.jsx";
import BandPowerChart from "../components/BandPowerChart.jsx";

export default function ResultsPage() {
  const [params] = useSearchParams();
  const id = params.get("id");
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let url = id ? `/api/sessions/${id}` : `/api/sessions/latest`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        // /latest returns dict per-mode; pick most recent focus
        if (!id) setSession(d.focus);
        else setSession(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-terminal-dim font-terminal">Loading…</div>;
  if (!session) {
    return (
      <div className="card">
        <p>No session found. Run a focus session first.</p>
        <Link to="/focus" className="btn-primary mt-4 inline-flex">
          Start Focus Training →
        </Link>
      </div>
    );
  }

  const samples = session.samples || [];
  const tbSeries = samples.map((s) => ({ t: Number(s.t.toFixed(1)), theta_beta: s.theta_beta, score: Math.round(s.score * 100) }));
  const bandSeries = samples.map((s) => ({
    t: Number(s.t.toFixed(1)),
    delta: s.delta, theta: s.theta, alpha: s.alpha, beta: s.beta, gamma: s.gamma,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Session Results</h1>
        <Link to="/history" className="btn-ghost">All Sessions →</Link>
      </div>

      <SessionCard session={session} />

      <div className="card">
        <h3 className="font-semibold mb-3">Theta/Beta Ratio + Score over Time</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={tbSeries}>
            <CartesianGrid stroke="#113311" strokeDasharray="3 3" />
            <XAxis dataKey="t" stroke="#00aa00" fontSize={11} tickFormatter={(v) => v.toFixed(0) + "s"} />
            <YAxis yAxisId="l" stroke="#00aa00" fontSize={11} />
            <YAxis yAxisId="r" orientation="right" stroke="#00aa00" fontSize={11} domain={[0, 100]} />
            <Tooltip contentStyle={{ background: "#000000", border: "1px solid #00aa00", color: "#00ff00" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line yAxisId="l" dataKey="theta_beta" stroke="#00ff00" name="θ/β" dot={false} strokeWidth={2} isAnimationActive={false} />
            <Line yAxisId="r" dataKey="score" stroke="#00aa00" name="score %" dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">Band Power Evolution</h3>
        <BandPowerChart data={bandSeries} height={260} />
      </div>
    </div>
  );
}
