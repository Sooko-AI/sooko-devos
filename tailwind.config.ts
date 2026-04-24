import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          0: "#09090b",
          1: "rgba(255,255,255,0.03)",
          2: "rgba(255,255,255,0.05)",
          3: "rgba(255,255,255,0.08)",
        },
        border: {
          subtle: "rgba(255,255,255,0.06)",
          DEFAULT: "rgba(255,255,255,0.1)",
          strong: "rgba(255,255,255,0.15)",
        },
        accent: {
          DEFAULT: "#6366f1",
          light: "#818cf8",
          muted: "#a5b4fc",
          dim: "rgba(99,102,241,0.15)",
        },
        text: {
          primary: "#f4f4f5",
          secondary: "rgba(255,255,255,0.6)",
          muted: "rgba(255,255,255,0.4)",
          dim: "rgba(255,255,255,0.25)",
        },
        severity: {
          high: "#f87171",
          medium: "#fbbf24",
          low: "#60a5fa",
          success: "#34d399",
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      animation: {
        "fade-in": "fadeInUp 0.5s ease both",
        "pulse-slow": "pulse 2s ease infinite",
        spin: "spin 0.8s linear infinite",
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
