/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Broadcast-optimized bright colors for TV display
        'tv-primary': '#0066CC',
        'tv-secondary': '#FF6B00',
        'tv-success': '#00C853',
        'tv-danger': '#DC143C',
        'tv-warning': '#FFD600',
      },
    },
  },
  plugins: [],
}
