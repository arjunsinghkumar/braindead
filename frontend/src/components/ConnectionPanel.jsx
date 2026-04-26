import { useState } from "react";

export default function ConnectionPanel({ board, onConnect, onDisconnect }) {
  const [macAddress, setMacAddress] = useState("");
  const [bt, setBt] = useState({ loading: false, error: null, devices: [] });

  const scanBluetooth = async () => {
    setBt((b) => ({ ...b, loading: true, error: null }));
    try {
      const r = await fetch("/api/bluetooth/devices");
      const d = await r.json();
      if (!r.ok || !d?.ok) {
        throw new Error(d?.error || "Bluetooth scan failed");
      }
      setBt({ loading: false, error: null, devices: d.devices || [] });
    } catch (e) {
      setBt((b) => ({ ...b, loading: false, error: e?.message || String(e) }));
    }
  };

  return (
    <div className="card max-w-xl">
      <h2 className="font-semibold text-lg mb-1">Connect to OpenBCI Ganglion</h2>
      <p className="text-xs text-terminal-dim mb-4 font-terminal">
        Pair the Ganglion using normal OS Bluetooth first, then connect here.
        If you know the device MAC address, enter it to use native BLE mode.
      </p>

      {board?.connected ? (
        <div className="space-y-3">
          <div className="text-sm text-terminal-text font-terminal">
            <div>
              Connected to <span className="font-mono">Ganglion</span>{" "}
              ({board.sampling_rate} Hz)
            </div>
            <div className="text-xs text-terminal-dim mt-1">
              Mode: <span className="font-mono">{board.connection || "—"}</span>
            </div>
            <div className="text-xs text-terminal-dim">
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
              <label className="text-xs text-terminal-dim font-terminal">
                Ganglion MAC address (optional)
              </label>
            </div>
            <input
              type="text"
              placeholder="AA:BB:CC:DD:EE:FF"
              className="w-full bg-ink-800 px-3 py-2 rounded text-sm font-mono border border-terminal-accent/60 focus:outline-none focus:ring-2 focus:ring-terminal-accent/30"
              value={macAddress}
              onChange={(e) => setMacAddress(e.target.value)}
            />
            <p className="text-xs text-terminal-dim mt-1 font-terminal">
              Leave blank to use default connection settings (or server env `GANGLION_MAC`).
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button className="btn-ghost" onClick={scanBluetooth} disabled={bt.loading}>
                {bt.loading ? "Scanning Bluetooth…" : "Scan Bluetooth"}
              </button>
              {bt.error && (
                <span className="text-xs text-bad font-terminal">{bt.error}</span>
              )}
            </div>
            {!!bt.devices.length && (
              <div className="mt-3 border border-terminal-accent/40 rounded p-3">
                <div className="text-xs text-terminal-dim font-terminal mb-2">
                  Devices (click to fill MAC)
                </div>
                <div className="space-y-1.5">
                  {bt.devices.slice(0, 12).map((d, idx) => (
                    <button
                      key={`${d.name || "device"}-${d.address || "na"}-${idx}`}
                      className="w-full text-left px-2 py-1 rounded hover:bg-ink-700/60 font-terminal"
                      onClick={() => d.address && setMacAddress(d.address)}
                      disabled={!d.address}
                      title={!d.address ? "No address available from macOS" : "Use this address"}
                    >
                      <span className={d.likely_ganglion ? "text-terminal-text" : "text-terminal-dim"}>
                        {d.likely_ganglion ? "[Ganglion?] " : ""}
                        {d.name || "Unknown device"}
                      </span>
                      <span className="font-mono ml-3 text-terminal-text">
                        {d.address || "—"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            className="btn-primary w-full"
            onClick={() => onConnect({ mac_address: macAddress.trim() || undefined })}
          >
            Connect
          </button>
        </div>
      )}
    </div>
  );
}
