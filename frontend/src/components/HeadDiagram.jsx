/**
 * Stylised top-down head with electrode positions for Cz / C3 / C4 + ear refs.
 */
const STATUS_COLOR = {
  good: "#00ff00",
  marginal: "#ffff00",
  bad: "#ff0000",
  unknown: "#004400",
};

export default function HeadDiagram({ statuses = {} }) {
  const dot = (label) => STATUS_COLOR[statuses[label]?.status || "unknown"];
  return (
    <svg viewBox="0 0 240 240" className="w-full max-w-xs mx-auto">
      {/* head outline */}
      <circle
        cx="120" cy="120" r="100"
        fill="#111111" stroke="#00aa00" strokeWidth="2"
      />
      {/* nose */}
      <polygon points="115,22 125,22 120,8" fill="#00aa00" />
      {/* ears */}
      <ellipse cx="20" cy="120" rx="8" ry="18" fill="#00aa00" />
      <ellipse cx="220" cy="120" rx="8" ry="18" fill="#00aa00" />
      {/* electrode labels (A1=L ear, A2=R ear) */}
      <text x="20" y="160" textAnchor="middle" fill="#00ff00" fontSize="10">A1</text>
      <text x="220" y="160" textAnchor="middle" fill="#00ff00" fontSize="10">A2</text>

      {/* Cz centre, C3 left, C4 right (10-20 system) */}
      <g>
        <circle cx="120" cy="120" r="14" fill={dot("Cz")} stroke="#000000" strokeWidth="2" />
        <text x="120" y="124" textAnchor="middle" fill="#000000" fontSize="11" fontWeight="700">Cz</text>
      </g>
      <g>
        <circle cx="74" cy="120" r="13" fill={dot("C3")} stroke="#000000" strokeWidth="2" />
        <text x="74" y="124" textAnchor="middle" fill="#000000" fontSize="11" fontWeight="700">C3</text>
      </g>
      <g>
        <circle cx="166" cy="120" r="13" fill={dot("C4")} stroke="#000000" strokeWidth="2" />
        <text x="166" y="124" textAnchor="middle" fill="#000000" fontSize="11" fontWeight="700">C4</text>
      </g>
    </svg>
  );
}
