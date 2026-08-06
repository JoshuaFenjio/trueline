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
        bg: "#FAFAF7",
        "bg-alt": "#F3F2EE",
        ink: {
          DEFAULT: "#171614", // warm near-black — primary text
          muted: "#6B6660", // secondary
          faint: "#9C968C", // tertiary
        },
        accent: "#0F766E", // deep teal — structural
        ember: "#E5532F", // below market (semantic)
        mint: "#1E9E6A", // above market / verified (semantic, data only)
        brand: {
          // legacy brand aliases now resolve to the single teal accent
          1: "#0F766E",
          2: "#0F766E",
          3: "#0F766E",
          ring: "#0F766E",
        },
      },
      fontFamily: {
        sans: ["var(--font-schibsted)", "system-ui", "sans-serif"],
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
