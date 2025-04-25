import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: '#333',
            a: {
              color: '#3182ce',
              '&:hover': {
                color: '#2c5282',
              },
            },
            pre: {
              backgroundColor: '#1a1a1a',
              color: '#e5e7eb',
              padding: '1rem',
              borderRadius: '0.5rem',
              overflowX: 'auto',
            },
            code: {
              color: '#e3116c',
              '&::before': {
                content: '""',
              },
              '&::after': {
                content: '""',
              },
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            h1: {
              fontWeight: '800',
              fontSize: '2.25rem',
            },
            h2: {
              fontWeight: '700',
              fontSize: '1.875rem',
            },
            h3: {
              fontWeight: '600',
              fontSize: '1.5rem',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/line-clamp'),
    require('tailwindcss-animate'),
  ],
}

export default config