import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const COLORS = {
  delta: "#00ff00",
  theta: "#00dd00",
  alpha: "#00aa00",
  beta:  "#33ff33",
  gamma: "#66ff66",
};

export default function BandPowerChart({ data = [], height = 240 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#113311" strokeDasharray="3 3" />
        <XAxis dataKey="t" tickFormatter={(v) => v.toFixed(0) + "s"}
               stroke="#00aa00" fontSize={11} />
        <YAxis stroke="#00aa00" fontSize={11} />
        <Tooltip
          contentStyle={{ background: "#000000", border: "1px solid #00aa00", color: "#00ff00" }}
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
