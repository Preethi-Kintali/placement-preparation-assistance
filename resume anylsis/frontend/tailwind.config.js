/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        page: "#f8fafc",
        ink: "#0f172a",
        accent: "#0ea5e9",
        warm: "#f97316",
      },
    },
  },
  plugins: [],
};
