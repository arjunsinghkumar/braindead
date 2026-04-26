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
        <CartesianGrid stroke="#113311" strokeDasharray="3 3" />
        <XAxis dataKey="idx" stroke="#00aa00" fontSize={11} />
        <YAxis yAxisId="l" stroke="#00aa00" fontSize={11} />
        <YAxis yAxisId="r" orientation="right" stroke="#00aa00" fontSize={11} />
        <Tooltip contentStyle={{ background: "#000000", border: "1px solid #00aa00", color: "#00ff00" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line yAxisId="l" type="monotone" dataKey="avg" name="avg %" stroke="#00ff00" strokeWidth={2} dot />
        <Line yAxisId="l" type="monotone" dataKey="peak" name="peak %" stroke="#00aa00" strokeWidth={2} dot />
        <Line yAxisId="r" type="monotone" dataKey="theta_beta" name="θ/β" stroke="#33ff33" strokeWidth={2} dot />
      </LineChart>
    </ResponsiveContainer>
  );
}
