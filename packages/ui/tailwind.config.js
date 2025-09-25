const { fontFamily } = require("tailwindcss/defaultTheme")

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        warning: "hsl(var(--warning))",
        success: "hsl(var(--success))",
        info: "hsl(var(--info))",
        "focus-block": "hsl(var(--focus-block))",
        "gcal-event": "hsl(var(--gcal-event))",
        rose: {
          DEFAULT: "hsl(var(--rose))",
          bg: "hsl(var(--rose-bg))",
        },
        amber: {
          DEFAULT: "hsl(var(--amber))",
          bg: "hsl(var(--amber-bg))",
        },
        mint: {
          DEFAULT: "hsl(var(--mint))",
          bg: "hsl(var(--mint-bg))",
        },
        sky: {
          DEFAULT: "hsl(var(--sky))",
          bg: "hsl(var(--sky-bg))",
        },
        violet: {
          DEFAULT: "hsl(var(--violet))",
          bg: "hsl(var(--violet-bg))",
        },
        lime: {
          DEFAULT: "hsl(var(--lime))",
          bg: "hsl(var(--lime-bg))",
        },
        teal: {
          DEFAULT: "hsl(var(--teal))",
          bg: "hsl(var(--teal-bg))",
        },
        crimson: {
          DEFAULT: "hsl(var(--crimson))",
          bg: "hsl(var(--crimson-bg))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", ...fontFamily.sans],
        heading: ["var(--font-heading)", ...fontFamily.sans],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}