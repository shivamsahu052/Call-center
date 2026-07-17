/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}', './features/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        dialer: {
          bg: '#FFFFFF',
          'bg-dark': '#121212',
          surface: '#F1F3F4',
          'surface-dark': '#1E1E1E',
          primary: '#1A73E8',
          call: '#34A853',
          'call-pressed': '#2D9249',
          end: '#EA4335',
          'end-pressed': '#D33426',
          text: '#202124',
          'text-dark': '#E8EAED',
          muted: '#5F6368',
          'muted-dark': '#9AA0A6',
          border: '#DADCE0',
          'border-dark': '#3C4043',
          accent: '#4285F4',
        },
      },
    },
  },
  plugins: [],
};
