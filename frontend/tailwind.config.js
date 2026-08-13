/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0F',
        surface: '#1A1A24',
        primary: '#00FFD1',
        secondary: '#BF00FF',
        accent: '#FF006E',
        text: '#FFFFFF',
        muted: '#8888A0',
        border: '#2A2A38'
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif']
      },
      keyframes: {
        'neon-glow': {
          '0%, 100%': {
            boxShadow: '0 0 5px #00FFD1, 0 0 10px #00FFD1, 0 0 20px #00FFD1, 0 0 40px #00FFD1'
          },
          '50%': {
            boxShadow: '0 0 10px #00FFD1, 0 0 20px #00FFD1, 0 0 40px #00FFD1, 0 0 80px #00FFD1'
          }
        },
        'neon-glow-purple': {
          '0%, 100%': {
            boxShadow: '0 0 5px #BF00FF, 0 0 10px #BF00FF, 0 0 20px #BF00FF, 0 0 40px #BF00FF'
          },
          '50%': {
            boxShadow: '0 0 10px #BF00FF, 0 0 20px #BF00FF, 0 0 40px #BF00FF, 0 0 80px #BF00FF'
          }
        },
        'neon-glow-pink': {
          '0%, 100%': {
            boxShadow: '0 0 5px #FF006E, 0 0 10px #FF006E, 0 0 20px #FF006E, 0 0 40px #FF006E'
          },
          '50%': {
            boxShadow: '0 0 10px #FF006E, 0 0 20px #FF006E, 0 0 40px #FF006E, 0 0 80px #FF006E'
          }
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        'float-up': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-100px)', opacity: '0' }
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0) rotate(0deg)' },
          '10%': { transform: 'translateX(-5px) rotate(-5deg)' },
          '20%': { transform: 'translateX(5px) rotate(5deg)' },
          '30%': { transform: 'translateX(-5px) rotate(-5deg)' },
          '40%': { transform: 'translateX(5px) rotate(5deg)' },
          '50%': { transform: 'translateX(-3px) rotate(-3deg)' },
          '60%': { transform: 'translateX(3px) rotate(3deg)' },
          '70%': { transform: 'translateX(-2px) rotate(-2deg)' },
          '80%': { transform: 'translateX(2px) rotate(2deg)' },
          '90%': { transform: 'translateX(-1px) rotate(-1deg)' }
        },
        'rarity-ssr': {
          '0%, 100%': {
            boxShadow: '0 0 20px #FF00FF, 0 0 40px #00FFFF, 0 0 60px #FFFF00'
          },
          '33%': {
            boxShadow: '0 0 20px #00FFFF, 0 0 40px #FFFF00, 0 0 60px #FF00FF'
          },
          '66%': {
            boxShadow: '0 0 20px #FFFF00, 0 0 40px #FF00FF, 0 0 60px #00FFFF'
          }
        }
      },
      animation: {
        'neon-glow': 'neon-glow 2s ease-in-out infinite',
        'neon-glow-purple': 'neon-glow-purple 2s ease-in-out infinite',
        'neon-glow-pink': 'neon-glow-pink 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.5s ease-out forwards',
        'slide-up': 'slide-up 0.6s ease-out forwards',
        'float-up': 'float-up 2s ease-out forwards',
        'shake': 'shake 0.8s ease-in-out',
        'rarity-ssr': 'rarity-ssr 2s ease-in-out infinite'
      }
    }
  },
  plugins: []
};