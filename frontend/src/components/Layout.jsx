import { NavLink, Link } from "react-router-dom";
import useSocket from "../hooks/useSocket.js";
import BatteryIndicator from "./BatteryIndicator.jsx";
import BrainDeadLogo from "./BrainDeadLogo.jsx";

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
    <div className="min-h-screen flex flex-col bg-terminal-bg text-terminal-text">
      <header className="border-b border-terminal-accent bg-black/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 grid place-items-center rounded-xl border border-terminal-accent/70 shadow-glow">
              <BrainDeadLogo className="w-6 h-6 text-terminal-text" />
            </div>
            <div>
              <div className="font-bold tracking-wide font-terminal">brainDead</div>
              <div className="text-xs text-terminal-dim">
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
                  `px-3 py-1.5 rounded-md transition font-terminal ${
                    isActive
                      ? "bg-terminal-accent text-black"
                      : "text-terminal-text hover:bg-ink-700"
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
                  : "bg-ink-700/60 text-terminal-text"
              }`}
            >
              ● board {board?.connected ? "Ganglion" : "off"}
            </span>
            {board?.connected && <BatteryIndicator percent={battery} />}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-6">{children}</main>
      <footer className="border-t border-terminal-accent/60 text-xs text-terminal-dim py-3 font-terminal">
        <div className="max-w-6xl mx-auto px-6">
          Educational tool — not a medical device. Theta/beta measurements cannot
          diagnose ADHD or any condition.
        </div>
      </footer>
    </div>
  );
}
