/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#000000",
        foreground: "#00ff00",
        terminal: {
          bg: "#000000",
          text: "#00ff00",
          accent: "#00aa00",
          dim: "#008800",
        },
        ink: {
          900: "#000000",
          800: "#111111",
          700: "#222222",
          600: "#333333",
        },
        accent: {
          400: "#00ff00",
          500: "#00dd00",
          600: "#00aa00",
        },
        good: "#00ff00",
        warn: "#ffff00",
        bad: "#ff0000",
      },
      fontFamily: {
        terminal: ['"Courier New"', 'monospace'],
      },
      boxShadow: {
        glow: "0 0 20px rgba(0,255,0,0.5)",
        terminal: "0 0 10px rgba(0,255,0,0.3)",
      },
    },
  },
  plugins: [],
};
