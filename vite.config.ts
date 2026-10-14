import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// base './' keeps the built site working under the GitHub Pages sub-path.
export default defineConfig({
  base: './',
  plugins: [preact()],
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.{ts,tsx}'],
    globals: false,
    restoreMocks: true,
  },
});
