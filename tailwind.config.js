/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#1e2d3c',
        teal: '#7fb9b7',
        tealsoft: '#cfe8e4',
        blush: '#e7b0a4',
        cream: '#efe7cf',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 30px rgba(30, 45, 60, 0.12)',
        softLg: '0 18px 50px rgba(30, 45, 60, 0.16)',
      },
      borderRadius: {
        xl: '1.25rem',
        '2xl': '1.75rem',
      },
    },
  },
  plugins: [],
};
