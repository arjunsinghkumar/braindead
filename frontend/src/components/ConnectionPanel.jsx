import { useEffect, useState } from "react";

export default function ConnectionPanel({ board, onConnect, onDisconnect }) {
  const [serial, setSerial] = useState("");
  const [ports, setPorts] = useState([]);
  const [loadingPorts, setLoadingPorts] = useState(false);

  const refreshPorts = async () => {
    setLoadingPorts(true);
    try {
      const r = await fetch("/api/board/ports");
      const d = await r.json();
      setPorts(d.ports || []);
      if (!serial && d.ports?.length) setSerial(d.ports[0]);
    } catch {
      setPorts([]);
    } finally {
      setLoadingPorts(false);
    }
  };

  useEffect(() => {
    refreshPorts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card max-w-xl">
      <h2 className="font-semibold text-lg mb-1">Connect to OpenBCI Ganglion</h2>
      <p className="text-xs text-slate-400 mb-4">
        Plug in the BLED112 dongle, power the Ganglion, then pick its serial
        port below. BrainFlow handles BLE pairing automatically.
      </p>

      {board?.connected ? (
        <div className="space-y-3">
          <div className="text-sm text-slate-300">
            <div>
              Connected to <span className="font-mono">Ganglion</span>{" "}
              ({board.sampling_rate} Hz)
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Port: <span className="font-mono">{board.serial_port}</span>
            </div>
            <div className="text-xs text-slate-400">
              Channels: {board.active_channels?.join(", ")}
            </div>
          </div>
          <button className="btn-danger" onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">
                Serial port (BLED112 dongle)
              </label>
              <button
                onClick={refreshPorts}
                className="text-xs text-accent-400 hover:underline disabled:opacity-50"
                disabled={loadingPorts}
              >
                {loadingPorts ? "scanning…" : "↻ rescan"}
              </button>
            </div>
            {ports.length > 0 ? (
              <select
                className="w-full bg-ink-700 px-3 py-2 rounded-md text-sm font-mono"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
              >
                {ports.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="/dev/cu.usbmodem* or COM4"
                className="w-full bg-ink-700 px-3 py-2 rounded-md text-sm font-mono"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
              />
            )}
            {ports.length === 0 && (
              <p className="text-xs text-slate-500 mt-1">
                No serial ports detected. Plug the BLED112 dongle in and click
                rescan, or type the path manually.
              </p>
            )}
          </div>
          <button
            className="btn-primary w-full"
            disabled={!serial.trim()}
            onClick={() => onConnect({ serial_port: serial.trim() })}
          >
            Pair &amp; Connect
          </button>
        </div>
      )}
    </div>
  );
}
