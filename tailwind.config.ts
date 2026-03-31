import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // -------------------------------------------------------
      // Design System – GlaucoBarber / Art Shave aesthetic
      // Dark premium barbershop + warm gold accent
      // -------------------------------------------------------
      colors: {
        // Brand
        gold: {
          50:  "#fdf8ec",
          100: "#f9edcc",
          200: "#f3d996",
          300: "#ecc05d",
          400: "#e5a930",
          500: "#C9A84C", // primary accent
          600: "#a8832a",
          700: "#80611f",
          800: "#5a4418",
          900: "#3a2d10",
          950: "#1e1708",
        },
        // Surfaces (dark)
        surface: {
          DEFAULT: "#111118",
          50:  "#f7f7f8",
          100: "#ebebef",
          200: "#d1d1db",
          300: "#a9a9bc",
          400: "#6c6c89",
          500: "#55556d",
          600: "#3f3f50",
          700: "#2a2a38",
          800: "#1d1d28",
          900: "#111118",
          950: "#0a0a0f",
        },
        // Semantic tokens
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Cal Sans", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "gold-sm": "0 1px 3px 0 rgba(201,168,76,.2)",
        "gold-md": "0 4px 16px 0 rgba(201,168,76,.15)",
        "gold-lg": "0 8px 32px 0 rgba(201,168,76,.12)",
        "dark-sm": "0 1px 2px 0 rgba(10,10,15,.4)",
        "dark-md": "0 4px 16px 0 rgba(10,10,15,.5)",
        "dark-lg": "0 8px 32px 0 rgba(10,10,15,.6)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-16px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%":       { opacity: "0.5" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "fade-in":        "fade-in 0.4s cubic-bezier(0.4,1,0.65,1)",
        "slide-in-left":  "slide-in-left 0.3s cubic-bezier(0.4,1,0.65,1)",
        shimmer:          "shimmer 2s infinite",
        pulse:            "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
      },
    },
  },
  plugins: [animate],
};

export default config;
