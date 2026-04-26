import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const COLORS = {
  delta: "#0ea5e9",
  theta: "#a855f7",
  alpha: "#22c55e",
  beta:  "#eab308",
  gamma: "#ef4444",
};

export default function BandPowerChart({ data = [], height = 240 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
        <XAxis dataKey="t" tickFormatter={(v) => v.toFixed(0) + "s"}
               stroke="#64748b" fontSize={11} />
        <YAxis stroke="#64748b" fontSize={11} />
        <Tooltip
          contentStyle={{ background: "#0b0f17", border: "1px solid #1f2937" }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {Object.entries(COLORS).map(([band, color]) => (
          <Area
            key={band}
            type="monotone"
            dataKey={band}
            stackId="1"
            stroke={color}
            fill={color}
            fillOpacity={0.55}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
