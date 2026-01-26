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
      },
      keyframes: {
        // Dice appearing with bounce and scale
        diceAppear: {
          '0%': { transform: 'scale(0) rotate(-180deg)', opacity: '0' },
          '60%': { transform: 'scale(1.1) rotate(10deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' }
        },
        // Dice rolling/spinning animation
        diceRoll: {
          '0%': { transform: 'rotateX(0deg) rotateY(0deg)' },
          '25%': { transform: 'rotateX(90deg) rotateY(45deg)' },
          '50%': { transform: 'rotateX(180deg) rotateY(90deg)' },
          '75%': { transform: 'rotateX(270deg) rotateY(135deg)' },
          '100%': { transform: 'rotateX(360deg) rotateY(180deg)' }
        },
        // Dice value reveal with slight bounce
        diceSettle: {
          '0%': { transform: 'scale(1.2)', opacity: '0' },
          '50%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        // Modifier fade in from side
        modifierSlideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        // Casualty number emphasis
        casualtyPop: {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '50%': { transform: 'scale(1.3)' },
          '70%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        // Conquest celebration pulse
        conquestPulse: {
          '0%': { transform: 'scale(1)', textShadow: '0 0 0 rgba(74, 222, 128, 0)' },
          '50%': { transform: 'scale(1.05)', textShadow: '0 0 20px rgba(74, 222, 128, 0.8)' },
          '100%': { transform: 'scale(1)', textShadow: '0 0 0 rgba(74, 222, 128, 0)' }
        },
        // Results fade in
        fadeInUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      },
      animation: {
        'dice-appear': 'diceAppear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'dice-roll': 'diceRoll 0.3s linear infinite',
        'dice-settle': 'diceSettle 0.3s ease-out forwards',
        'modifier-slide': 'modifierSlideIn 0.3s ease-out forwards',
        'casualty-pop': 'casualtyPop 0.4s ease-out forwards',
        'conquest-pulse': 'conquestPulse 1s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 0.3s ease-out forwards'
      }
    },
  },
  plugins: [],
} satisfies Config
