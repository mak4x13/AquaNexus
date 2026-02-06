/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "aqua-glow": "#38bdf8",
        "aqua-deep": "#0f172a",
        "aqua-mist": "#cbd5f5",
        "aqua-ember": "#f59e0b"
      },
      boxShadow: {
        glass: "0 10px 40px rgba(15, 23, 42, 0.45)",
        "inner-glow": "inset 0 0 30px rgba(56, 189, 248, 0.35)"
      },
      backdropBlur: {
        glass: "18px"
      }
    }
  },
  plugins: []
};
