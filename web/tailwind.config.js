/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        night: '#0b1224',
        neon: '#5af5ff',
        magenta: '#ff4fa7',
        amber: '#ffbd59',
      },
      boxShadow: {
        glow: '0 0 25px rgba(90,245,255,0.35)',
      },
    },
  },
  plugins: [],
};
