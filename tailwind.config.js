/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./renderer/index.html', './renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f1115', panel: '#161922', panel2: '#1d212c', panel3: '#232834',
        bd: '#2a303d', bd2: '#363d4d', tx: '#e7e9ee', mut: '#8b93a5', mut2: '#636b7d',
        acc: '#5b8cff', accd: '#3f6fe0',
        crvena: '#e5484d', zelena: '#34b27b', plava: '#4f8cff', ljubicasta: '#9a6cff',
        prva: '#e9b949', druga: '#6f7dff',
        okc: '#2fa96b', warnc: '#e0a83a', errc: '#e5484d',
      },
      fontFamily: {
        sans: ['-apple-system', 'Segoe UI', 'Roboto', 'Ubuntu', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
