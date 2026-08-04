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
        bg: "#FFFFFF",
        "bg-alt": "#F7F8F9",
        ink: {
          DEFAULT: "#16181D", // primary text
          muted: "#5B6472", // secondary
          faint: "#98A1AD", // tertiary
        },
        ember: "#E5532F", // below market
        mint: "#1E9E6A", // above market / verified
        brand: {
          1: "#8F7BFF",
          2: "#5E8BFF",
          3: "#4EC9FF",
          ring: "#5E8BFF",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "12px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(16,24,40,.06)",
        "card-hover": "0 4px 12px rgba(16,24,40,.08)",
        glow: "0 4px 12px rgba(16,24,40,.08)", // legacy alias -> soft shadow
        marker: "0 1px 4px rgba(94,108,255,.5)",
      },
    },
  },
  plugins: [],
};

export default config;
