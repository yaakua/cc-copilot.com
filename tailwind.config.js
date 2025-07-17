/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: [
          'SF Mono',
          'Monaco',
          'Cascadia Code',
          'Roboto Mono',
          'Consolas',
          'Courier New',
          'monospace'
        ]
      },
      colors: {
        // Custom colors matching the prototype
        'terminal-bg': '#000000',
        'terminal-text': '#ffffff',
        'terminal-green': '#00ff00',
        'terminal-blue': '#0066ff',
        'terminal-cyan': '#00ffff',
      }
    },
  },
  plugins: [],
}