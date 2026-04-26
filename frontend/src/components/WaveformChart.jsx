import { useEffect, useRef } from "react";

const COLORS = { Cz: "#7dd3fc", C3: "#a78bfa", C4: "#fb7185" };

/**
 * Lightweight canvas-based scrolling EEG waveform.
 * Props:
 *   channels: { Cz: [..], C3: [..], C4: [..] }
 *   fs: sampling rate (Hz)
 */
export default function WaveformChart({ channels = {}, fs = 200, height = 220 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = (canvas.width = canvas.clientWidth * devicePixelRatio);
    const h = (canvas.height = height * devicePixelRatio);
    ctx.scale(devicePixelRatio, devicePixelRatio);

    ctx.fillStyle = "#0b0f17";
    ctx.fillRect(0, 0, canvas.clientWidth, height);

    const labels = Object.keys(channels);
    if (labels.length === 0) return;
    const rowH = height / labels.length;

    labels.forEach((label, idx) => {
      const data = channels[label] || [];
      if (!data.length) return;
      // baseline
      const yMid = idx * rowH + rowH / 2;
      ctx.strokeStyle = "#1a2230";
      ctx.beginPath();
      ctx.moveTo(0, yMid);
      ctx.lineTo(canvas.clientWidth, yMid);
      ctx.stroke();

      const maxAbs = Math.max(50, ...data.map((v) => Math.abs(v)));
      const yScale = (rowH * 0.4) / maxAbs;
      const xStep = canvas.clientWidth / data.length;

      ctx.strokeStyle = COLORS[label] || "#7dd3fc";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = i * xStep;
        const y = yMid - v * yScale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.fillStyle = COLORS[label] || "#7dd3fc";
      ctx.font = "11px ui-sans-serif";
      ctx.fillText(label, 6, idx * rowH + 14);
    });
  }, [channels, fs, height]);

  return (
    <canvas
      ref={ref}
      style={{ width: "100%", height: `${height}px`, borderRadius: 8 }}
    />
  );
}
