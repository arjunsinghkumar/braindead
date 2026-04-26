import { Link } from "react-router-dom";
import ConnectionPanel from "../components/ConnectionPanel.jsx";
import BatteryIndicator from "../components/BatteryIndicator.jsx";

const electrodeRows = [
  ["Channel 1 (+1, grey)", "Cz — vertex / midline", "Primary ADHD theta/beta site"],
  ["Channel 2 (+2, purple)", "C3 — left motor cortex", "Inattentive-type training"],
  ["Channel 3 (+3, blue)", "C4 — right motor cortex", "Hyperactive-type training"],
  ["Channel 4 (+4, green)", "Spare", "Reserved for EOG / artifacts"],
  ["REF (yellow)", "A1 — Left earlobe", "Reference"],
  ["D_G (black)", "A2 — Right earlobe", "Ground"],
];

export default function ConnectPage({ board, battery, onConnect, onDisconnect }) {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <ConnectionPanel
          board={board}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
        />
        <div className="card">
          <h2 className="font-semibold text-lg mb-3">Electrode Montage</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-terminal-dim font-terminal">
                <tr>
                  <th className="text-left py-1.5 font-medium">Lead</th>
                  <th className="text-left py-1.5 font-medium">Position</th>
                  <th className="text-left py-1.5 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {electrodeRows.map((r) => (
                  <tr key={r[0]} className="border-t border-ink-700">
                    <td className="py-1.5">{r[0]}</td>
                    <td className="py-1.5">{r[1]}</td>
                    <td className="py-1.5 text-terminal-dim font-terminal">{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-terminal-dim mt-3 font-terminal">
            All 4 DIP switches must be DOWN (monopolar EEG against shared REF).
          </p>
        </div>
      </div>

      {board?.connected && (
        <div className="card flex items-center justify-between gap-4">
          <div className="text-sm flex items-center gap-3">
            <span>Board ready. Run the 3-stage assessment in order.</span>
            <BatteryIndicator percent={battery} />
          </div>
          <Link to="/impedance" className="btn-primary">
            Start with Impedance Check →
          </Link>
        </div>
      )}

      <div className="card border-warn/40 bg-warn/5">
        <p className="text-sm text-warn">
          ⚠ Educational tool only. Theta/beta ratio measurements cannot diagnose
          ADHD or any clinical condition. Consult a qualified healthcare
          professional for clinical assessment.
        </p>
      </div>
    </div>
  );
}
