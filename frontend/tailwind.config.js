/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        byte: {
          bg: 'var(--bg-app)',
          surface: 'var(--bg-surface)',
          secondary: 'var(--bg-surface-secondary)',
          border: 'var(--border-app)',
          'border-subtle': 'var(--border-subtle)',
          primary: 'var(--text-primary)',
          muted: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          accent: 'var(--accent)',
          'accent-hover': 'var(--accent-hover)',
          'accent-contrast': 'var(--accent-contrast)',
        },
        bull: {
          DEFAULT: '#22B982',
          surface: 'rgba(34, 185, 130, 0.12)',
          border: 'rgba(34, 185, 130, 0.28)',
        },
        bear: {
          DEFAULT: '#EF6262',
          surface: 'rgba(239, 98, 98, 0.12)',
          border: 'rgba(239, 98, 98, 0.28)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      animation: {
        'ticker': 'ticker 35s linear infinite',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
};
