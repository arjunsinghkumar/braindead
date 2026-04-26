import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ConnectPage from "./pages/ConnectPage.jsx";
import ImpedancePage from "./pages/ImpedancePage.jsx";
import AlphaTestPage from "./pages/AlphaTestPage.jsx";
import FocusPage from "./pages/FocusPage.jsx";
import ResultsPage from "./pages/ResultsPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import useSocket from "./hooks/useSocket.js";

export default function App() {
  const { on, emit } = useSocket();
  const [board, setBoard] = useState({ connected: false });
  const [battery, setBattery] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const offStatus = on("board_status", (s) => {
      setBoard(s);
      if (!s.connected) setBattery(null);
    });
    const offBatt = on("battery_status", (b) => setBattery(b?.percent ?? null));
    const offErr = on("error", (e) => {
      setError(e.message || "Unknown error");
      setTimeout(() => setError(null), 5000);
    });
    fetch("/api/board/status").then((r) => r.json()).then(setBoard).catch(() => {});
    fetch("/api/board/battery")
      .then((r) => r.json())
      .then((d) => setBattery(d?.percent ?? null))
      .catch(() => {});
    return () => { offStatus(); offBatt(); offErr(); };
  }, [on]);

  const connectBoard = (opts) => emit("connect_board", opts);
  const disconnectBoard = () => emit("disconnect_board");

  return (
    <Layout board={board} battery={battery}>
      {error && (
        <div className="card border-bad/60 bg-bad/10 mb-4 text-sm text-bad">
          {error}
        </div>
      )}
      <Routes>
        <Route path="/" element={
          <ConnectPage
            board={board} battery={battery}
            onConnect={connectBoard} onDisconnect={disconnectBoard}
          />
        } />
        <Route path="/impedance" element={<ImpedancePage board={board} />} />
        <Route path="/alpha" element={<AlphaTestPage board={board} />} />
        <Route path="/focus" element={<FocusPage board={board} />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </Layout>
  );
}
