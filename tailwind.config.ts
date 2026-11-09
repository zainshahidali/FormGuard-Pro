import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#090D16",
          800: "#0F172A", // Primary Background / Sidebar
          700: "#131C35",
          600: "#1E293B",
        },
        surface: {
          DEFAULT: "#12263A", // Secondary Dark Surface
          hover: "#17304A",
          border: "#1E3A5F",
          muted: "#0C1B2B",
        },
        teal: {
          accent: "#0B6E77",
          hover: "#0D828D",
          light: "#149EAA",
        },
        sky: {
          accent: "#0EA5E9",
          hover: "#0284C7",
          glow: "rgba(14, 165, 233, 0.15)",
        },
      },
    },
  },
  plugins: [],
};

export default config;

