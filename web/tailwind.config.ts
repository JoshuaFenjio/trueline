import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#07080B",
        ink: {
          DEFAULT: "#F4F5F7", // primary text
          muted: "#A3A9B5", // secondary
          faint: "#6E7480", // tertiary
        },
        ember: "#FF6A45", // below market
        mint: "#4ADE9C", // above market
        brand: {
          1: "#8F7BFF",
          2: "#5E8BFF",
          3: "#4EC9FF",
          ring: "#7C6CFF",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        serif: ["var(--font-instrument)", "Georgia", "serif"],
      },
      borderRadius: {
        card: "18px",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,108,255,.20), 0 8px 40px -8px rgba(124,108,255,.45)",
        marker: "0 0 18px 2px rgba(124,108,255,.55)",
      },
    },
  },
  plugins: [],
};

export default config;
