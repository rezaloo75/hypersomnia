/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Kong brand palette
        kong: {
          50:  '#f0fde4',
          100: '#dcfcb3',
          200: '#bbf765',
          300: '#93ef2b',
          400: '#6fdc0e',  // primary brand green
          500: '#52b80a',
          600: '#3d9108',
          700: '#2f6f07',
          800: '#255509',
          900: '#1e470a',
          950: '#0d2505',
        },
        surface: {
          0: '#0a0a0a',   // Kong near-black
          1: '#111111',
          2: '#1a1a1a',
          3: '#242424',
        },
      },
    },
  },
  plugins: [],
}
