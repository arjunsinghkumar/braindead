/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0b0f17",
          800: "#111722",
          700: "#1a2230",
          600: "#252f40",
        },
        accent: {
          400: "#7dd3fc",
          500: "#38bdf8",
          600: "#0ea5e9",
        },
        good: "#22c55e",
        warn: "#eab308",
        bad: "#ef4444",
      },
      boxShadow: {
        glow: "0 0 60px rgba(56,189,248,0.45)",
      },
    },
  },
  plugins: [],
};
