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
        },
        // Territory selection glow pulse
        territoryPulse: {
          '0%, 100%': { filter: 'brightness(1) drop-shadow(0 0 0 transparent)' },
          '50%': { filter: 'brightness(1.2) drop-shadow(0 0 8px rgba(250, 204, 21, 0.5))' }
        },
        // Troop deployment pop
        troopDeploy: {
          '0%': { transform: 'scale(0) translateY(-20px)', opacity: '0' },
          '60%': { transform: 'scale(1.2) translateY(0)', opacity: '1' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' }
        },
        // Victory trophy bounce
        victoryBounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '25%': { transform: 'translateY(-15px)' },
          '50%': { transform: 'translateY(0)' },
          '75%': { transform: 'translateY(-8px)' }
        },
        // Star sparkle
        starSparkle: {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
          '50%': { transform: 'scale(1.2) rotate(180deg)', opacity: '0.8' }
        },
        // Phase slide transition
        phaseSlide: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        // Button press
        buttonPress: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.95)' }
        },
        // Shake for errors
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' }
        },
        // Glow pulse for highlights
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(250, 204, 21, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(250, 204, 21, 0.6)' }
        },
        // Spin for loading
        spin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' }
        },
        // Slide up for modals
        slideUp: {
          '0%': { transform: 'translateY(100px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        // Fade in
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        // Scale in for cards
        scaleIn: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        }
      },
      animation: {
        'dice-appear': 'diceAppear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'dice-roll': 'diceRoll 0.3s linear infinite',
        'dice-settle': 'diceSettle 0.3s ease-out forwards',
        'modifier-slide': 'modifierSlideIn 0.3s ease-out forwards',
        'casualty-pop': 'casualtyPop 0.4s ease-out forwards',
        'conquest-pulse': 'conquestPulse 1s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 0.3s ease-out forwards',
        'territory-pulse': 'territoryPulse 2s ease-in-out infinite',
        'troop-deploy': 'troopDeploy 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'victory-bounce': 'victoryBounce 1s ease-in-out infinite',
        'star-sparkle': 'starSparkle 2s ease-in-out infinite',
        'phase-slide': 'phaseSlide 0.3s ease-out forwards',
        'button-press': 'buttonPress 0.1s ease-in-out',
        'shake': 'shake 0.5s ease-in-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'spin': 'spin 1s linear infinite',
        'slide-up': 'slideUp 0.3s ease-out forwards',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'scale-in': 'scaleIn 0.2s ease-out forwards'
      }
    },
  },
  plugins: [],
} satisfies Config
