import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

export default function HistoryChart({ sessions = [], height = 240 }) {
  const data = sessions.map((s, i) => ({
    idx: i + 1,
    avg: Math.round((s.avg_score || 0) * 100),
    peak: Math.round((s.peak_score || 0) * 100),
    theta_beta: Number((s.avg_theta_beta || 0).toFixed(2)),
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
        <XAxis dataKey="idx" stroke="#64748b" fontSize={11} />
        <YAxis yAxisId="l" stroke="#64748b" fontSize={11} />
        <YAxis yAxisId="r" orientation="right" stroke="#64748b" fontSize={11} />
        <Tooltip contentStyle={{ background: "#0b0f17", border: "1px solid #1f2937" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line yAxisId="l" type="monotone" dataKey="avg" name="avg %" stroke="#38bdf8" strokeWidth={2} dot />
        <Line yAxisId="l" type="monotone" dataKey="peak" name="peak %" stroke="#22c55e" strokeWidth={2} dot />
        <Line yAxisId="r" type="monotone" dataKey="theta_beta" name="θ/β" stroke="#a855f7" strokeWidth={2} dot />
      </LineChart>
    </ResponsiveContainer>
  );
}
