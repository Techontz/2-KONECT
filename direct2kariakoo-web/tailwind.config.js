/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./app/**/*.{js,ts,jsx,tsx}",
      "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          brand: "#FFDE59", // your yellow accent
          darkText: "#232742",
          background: "#F6F6F6",
        },
        boxShadow: {
          brand: "0 4px 12px rgba(0,0,0,0.05)",
        },
        borderRadius: {
          lg: "18px",
        },
        fontFamily: {
          inter: ["Inter", "sans-serif"],
        },
      },
    },
    plugins: [],
  };
  