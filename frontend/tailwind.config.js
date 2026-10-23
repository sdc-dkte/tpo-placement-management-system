/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: '#FECC00',        // Official DKTE Brand Yellow
          yellowHover: '#E5B800',
          dark: '#111827',          // Near-Black
          sidebar: '#111827',
          canvas: '#F8FAFC',
        },
        tier: {
          regular: {
            bg: '#F3F4F6',
            text: '#374151',
          },
          dream: {
            bg: '#DBEAFE',
            text: '#1E40AF',
          },
          superDream: {
            bg: '#FECC00',
            text: '#111827',
          },
        },
        status: {
          successBg: '#DCFCE7',
          successText: '#15803D',
          warningBg: '#FEF3C7',
          warningText: '#92400E',
          infoBg: '#DBEAFE',
          infoText: '#1E40AF',
          neutralBg: '#F1F5F9',
          neutralText: '#475569',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',  // 4px ROUND_FOUR standard
        sm: '0.125rem',      // 2px
        md: '0.375rem',      // 6px
        lg: '0.5rem',        // 8px
        xl: '0.75rem',       // 12px
        full: '9999px',
      },
      boxShadow: {
        none: 'none',
        hairline: '0 0 0 1px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
}
