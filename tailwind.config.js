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
        inter: ['Inter', 'sans-serif'],
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
        // Claude color scheme
        'claude-bg': '#343130',
        'claude-sidebar': '#2C2A29',
        'claude-accent': '#D96D53',
        'claude-text-primary': '#E5E3E1',
        'claude-text-secondary': '#8F8C8A',
        'claude-border': '#4A4746',
        // Keep terminal colors for compatibility
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