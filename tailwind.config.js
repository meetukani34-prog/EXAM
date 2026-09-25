/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cyber: {
          50: "#f0fdfa",
          500: "#06b6d4",
          600: "#0891b2",
          900: "#164e63",
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        "glass-glow": "0 0 25px rgba(99, 102, 241, 0.25)",
        "glass-cyan": "0 0 25px rgba(6, 182, 212, 0.25)",
      },
    },
  },
  corePlugins: {
    preflight: false, // Prevents Tailwind from overriding existing application base styles
  },
  plugins: [],
};
