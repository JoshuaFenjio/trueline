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
          DEFAULT: "#0F1729", // ink navy — primary text
          muted: "#5B6472", // secondary
          faint: "#98A1AD", // tertiary
        },
        accent: "#2E5BFF", // single cobalt accent
        ember: "#E5532F", // below market
        mint: "#1E9E6A", // above market / verified
        brand: {
          // legacy brand aliases now resolve to the single accent
          1: "#2E5BFF",
          2: "#2E5BFF",
          3: "#2E5BFF",
          ring: "#2E5BFF",
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
