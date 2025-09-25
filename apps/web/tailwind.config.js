/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    // Scan the shared UI package for Tailwind classes
    "../../packages/ui/components/**/*.{js,ts,jsx,tsx}",
  ],
  // Use the UI package config as a preset
  presets: [require("../../packages/ui/tailwind.config.js")],
}