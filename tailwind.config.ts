import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        board: {
          wood: '#2C1810',
          parchment: '#F5E6D3',
          border: '#4A3728',
          sea: '#7BA3B8',
        },
        faction: {
          mechaniker: '#4A90A4',
          bear: '#8B4513',
          balkania: '#6B3FA0',
          khan: '#2F4F4F',
          saharan: '#DAA520',
        }
      },
      fontFamily: {
        display: ['Cinzel', 'serif'],
        body: ['Source Sans Pro', 'sans-serif'],
        numbers: ['Oswald', 'sans-serif'],
      }
    },
  },
  plugins: [],
} satisfies Config
