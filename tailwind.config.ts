import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17201c",
        mist: "#eef3f1",
        sage: "#6f8f7c",
        mint: "#4fb493",
        coral: "#e46f5f",
        amber: "#d9a33d",
        paper: "#fbfaf7"
      },
      boxShadow: {
        soft: "0 16px 40px rgba(23, 32, 28, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
