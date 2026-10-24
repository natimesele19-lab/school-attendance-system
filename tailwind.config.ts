import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#182c25",
        forest: "#176b52",
        mint: "#e9f4ef",
        paper: "#f7f9f7"
      },
      boxShadow: {
        card: "0 12px 36px rgba(24, 44, 37, 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
