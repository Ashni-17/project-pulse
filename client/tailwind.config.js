/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Instrument Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Cool blue-violet greys with a navy cast: the "ink" of the interface.
        ink: {
          50: '#f5f6fa', 100: '#eceef5', 200: '#dadeea', 300: '#b9c0d4', 400: '#8b95b2',
          500: '#667194', 600: '#4e597a', 700: '#3c4563', 800: '#242b44', 900: '#141a2e', 950: '#0a0e1c',
        },
        // The single accent: a heartbeat-monitor mint.
        pulse: {
          50: '#ecfdf7', 100: '#d0faed', 200: '#a4f3dc', 300: '#69e6c6', 400: '#30d0ab',
          500: '#12b693', 600: '#0a9479', 700: '#0b7762', 800: '#0d5f4f', 900: '#0e4e42',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(10,14,28,.06), 0 2px 8px -2px rgba(10,14,28,.08)',
        lift: '0 12px 32px -8px rgba(10,14,28,.28)',
      },
      keyframes: {
        beat: { '0%': { strokeDashoffset: '120' }, '100%': { strokeDashoffset: '0' } },
        pop: { '0%': { opacity: 0, transform: 'scale(.97)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
      },
      animation: { beat: 'beat 2.4s ease-out infinite', pop: 'pop .15s ease-out' },
    },
  },
  plugins: [],
};
