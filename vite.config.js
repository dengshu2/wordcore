import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Keep the two heavyweight, rarely-changing pieces in their own
        // long-term-cacheable chunks: the 2808-entry word bank and the
        // React runtime. App code changes then only invalidate the small
        // per-page chunks.
        manualChunks(id) {
          if (id.includes('src/data/words.json')) return 'wordbank'
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
    setupFiles: ['./src/test/setup.js'],
    globals: true,
  },
})
