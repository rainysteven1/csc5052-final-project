import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(24 28% 78%)",
        input: "hsl(24 28% 78%)",
        ring: "hsl(14 76% 50%)",
        background: "hsl(36 43% 95%)",
        foreground: "hsl(24 20% 14%)",
        primary: {
          DEFAULT: "hsl(14 76% 50%)",
          foreground: "hsl(30 100% 98%)",
        },
        secondary: {
          DEFAULT: "hsl(40 40% 88%)",
          foreground: "hsl(22 20% 20%)",
        },
        muted: {
          DEFAULT: "hsl(38 32% 90%)",
          foreground: "hsl(24 12% 38%)",
        },
        accent: {
          DEFAULT: "hsl(165 43% 36%)",
          foreground: "hsl(36 43% 97%)",
        },
        card: {
          DEFAULT: "hsl(36 43% 97%)",
          foreground: "hsl(24 20% 14%)",
        },
        destructive: {
          DEFAULT: "hsl(0 72% 50%)",
          foreground: "hsl(30 100% 98%)",
        },
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        display: ["'Space Grotesk'", "'IBM Plex Sans'", "sans-serif"],
      },
      boxShadow: {
        panel: "0 18px 60px rgba(120, 74, 35, 0.10)",
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(circle at top left, rgba(239, 119, 76, 0.22), transparent 35%), radial-gradient(circle at 80% 10%, rgba(72, 146, 127, 0.18), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.92), rgba(247,236,222,0.95))",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
