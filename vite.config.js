import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('recharts') || id.includes('react-is') || id.includes('d3-')) return 'charts'
          if (id.includes('framer-motion')) return 'motion'
          if (id.includes('dexie')) return 'dexie'
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.png', 'manifest.json'],
      manifest: false, // we use our own public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}', 'catalog/exercises.json', 'manifest.json'],
        globIgnores: ['catalog/images/**', 'catalog/videos/**'],
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/catalog\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/catalog/images/'),
            handler: 'CacheFirst',
            options: { cacheName: 'exercise-thumbnails', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom', setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'], css: false,
  },
})
