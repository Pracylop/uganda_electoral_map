/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // UI Style Guide - Official Color Palette
        'base': '#0A0E14',           // Deep Charcoal/Navy - main background
        'surface': '#161B22',         // Cards/Panels background
        'accent-cyan': '#00E5FF',     // Electric Cyan - interactions
        'accent-gold': '#FFD700',     // Amber Gold - selections, highlights

        // Status colors
        'status-success': '#22C55E',
        'status-error': '#EF4444',
        'status-warning': '#F59E0B',
        'status-info': '#3B82F6',

        // Political Party Colors (Official)
        'party-nrm': '#FFFF00',       // Bright Yellow
        'party-nup': '#FF0000',       // Vivid Red
        'party-fdc': '#0000FF',       // Electric Blue
        'party-dp': '#008000',        // Forest Green
        'party-upc': '#DC2626',       // Red
        'party-ant': '#7C3AED',       // Purple
        'party-ind': '#6B7280',       // Gray (Independent)

        // Legacy TV colors (kept for compatibility)
        'tv-primary': '#0066CC',
        'tv-secondary': '#FF6B00',
        'tv-success': '#00C853',
        'tv-danger': '#DC143C',
        'tv-warning': '#FFD600',
      },
      fontFamily: {
        'headline': ['Inter', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
        'body': ['Roboto', 'sans-serif'],
      },
      boxShadow: {
        'glow-gold': '0 0 20px rgba(255, 215, 0, 0.3)',
        'glow-cyan': '0 0 20px rgba(0, 229, 255, 0.3)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(245, 158, 11, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(245, 158, 11, 0.8)' },
        },
      },
    },
  },
  plugins: [],
}
