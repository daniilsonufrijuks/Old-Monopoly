/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#24180f',
        cream: '#f6ead0',
        paper: '#fffaf0',
        wood: '#5c3b24',
        gold: '#c6a15b',
        felt: '#1c4636',
      },
      fontFamily: {
        display: ['Cinzel', 'Palatino Linotype', 'serif'],
        body: ['Source Sans 3', 'Segoe UI', 'sans-serif'],
        deed: ['Libre Baskerville', 'Georgia', 'serif'],
      },
      boxShadow: {
        board: '0 30px 70px rgba(0,0,0,.45), inset 0 0 0 2px rgba(255,236,196,.35)',
      },
    },
  },
  plugins: [],
};
