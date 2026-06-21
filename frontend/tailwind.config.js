/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        glass: {
          light: 'rgba(255, 255, 255, 0.1)',
          DEFAULT: 'rgba(255, 255, 255, 0.05)',
          dark: 'rgba(0, 0, 0, 0.3)',
        },
        accent: {
          cyan: '#00d9ff',
          purple: '#8b5cf6',
          pink: '#ec4899',
          blue: '#3b82f6',
        },
      },
      backgroundColor: {
        gradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e293b 100%)',
      },
      backdropBlur: {
        glass: '10px',
      },
      borderColor: {
        glass: 'rgba(255, 255, 255, 0.15)',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'glass-lg': '0 8px 32px 0 rgba(31, 38, 135, 0.50)',
      },
      animation: {
        'gradient-shift': 'gradient-shift 15s ease infinite',
        'fade-in': 'fade-in 0.5s ease-in',
        'slide-up': 'slide-up 0.3s ease-out',
        'pulse-slow': 'pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: {
            opacity: '0',
            transform: 'translateY(10px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [
    function ({ addComponents, theme }) {
      addComponents({
        '.glass': {
          '@apply bg-glass backdrop-blur-glass border border-glass rounded-lg shadow-glass': {},
        },
        '.glass-light': {
          '@apply bg-glass-light backdrop-blur-glass border border-glass rounded-lg shadow-glass': {},
        },
        '.glass-card': {
          '@apply glass p-6 hover:shadow-glass-lg transition-shadow duration-300': {},
        },
        '.gradient-bg': {
          '@apply bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 animate-gradient-shift': {},
        },
        '.btn-glass': {
          '@apply px-6 py-2 rounded-lg bg-accent-cyan text-slate-950 font-semibold hover:shadow-glass-lg transition-all duration-200 hover:scale-105 active:scale-95': {},
        },
        '.btn-glass-secondary': {
          '@apply px-6 py-2 rounded-lg glass text-accent-cyan font-semibold hover:bg-glass-light transition-all duration-200': {},
        },
      });
    },
  ],
}
