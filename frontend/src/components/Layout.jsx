import { NavLink, Link } from "react-router-dom";
import useSocket from "../hooks/useSocket.js";
import BatteryIndicator from "./BatteryIndicator.jsx";

const tabs = [
  { to: "/", label: "Connect" },
  { to: "/impedance", label: "1. Impedance" },
  { to: "/alpha", label: "2. Alpha Test" },
  { to: "/focus", label: "3. Focus Train" },
  { to: "/history", label: "History" },
];

export default function Layout({ children, board, battery }) {
  const { connected } = useSocket();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-ink-700 bg-ink-800/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl focus-orb shadow-glow" />
            <div>
              <div className="font-bold tracking-wide">NeuroFlow</div>
              <div className="text-xs text-slate-400">
                OpenBCI Ganglion Neurofeedback
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === "/"}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md transition ${
                    isActive
                      ? "bg-accent-600 text-white"
                      : "text-slate-300 hover:bg-ink-700"
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`pill ${
                connected ? "bg-good/20 text-good" : "bg-bad/20 text-bad"
              }`}
            >
              ● ws {connected ? "live" : "off"}
            </span>
            <span
              className={`pill ${
                board?.connected
                  ? "bg-good/20 text-good"
                  : "bg-slate-600/40 text-slate-300"
              }`}
            >
              ● board {board?.connected ? "Ganglion" : "off"}
            </span>
            {board?.connected && <BatteryIndicator percent={battery} />}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-6">{children}</main>
      <footer className="border-t border-ink-700 text-xs text-slate-400 py-3">
        <div className="max-w-6xl mx-auto px-6">
          Educational tool — not a medical device. Theta/beta measurements cannot
          diagnose ADHD or any condition.
        </div>
      </footer>
    </div>
  );
}
