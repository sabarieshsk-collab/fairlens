/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f0e0d",
        "ink-soft": "#3a3835",
        "ink-muted": "#6b6862",
        "ink-faint": "#a8a49f",
        paper: "#faf9f6",
        "paper-warm": "#f3f0ea",
        "paper-card": "#ffffff",
        accent: "#c9400a",
        "accent-light": "#f7e8e1",
        accent2: "#1a4d7a",
        "accent2-light": "#e3edf5",
        success: "#1a6b3a",
        "success-light": "#e3f2e8",
        warn: "#8a5a00",
        "warn-light": "#fdf3dc",
        rule: "#e0dbd3",
      },
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
    },
  },
  plugins: [],
}
