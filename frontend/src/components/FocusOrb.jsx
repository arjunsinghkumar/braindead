export default function FocusOrb({ score = 0, size = 220 }) {
  const s = Math.max(0, Math.min(1, score));
  const scale = 0.55 + s * 0.55;          // 0.55 → 1.10
  const glow = 12 + s * 90;                // px
  const opacity = 0.55 + s * 0.45;
  return (
    <div
      className="focus-orb pulse-soft mx-auto"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        transform: `scale(${scale})`,
        boxShadow: `0 0 ${glow}px rgba(56,189,248,${opacity})`,
        opacity,
      }}
    />
  );
}
