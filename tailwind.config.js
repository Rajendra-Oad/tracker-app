/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#f4f4f5",
        muted: "#9b9da4",
        canvas: "#101214",
        panel: "#1b1d20",
        line: "#303238",
        accent: "#67d4df",
      },
    },
  },
  plugins: [],
};
