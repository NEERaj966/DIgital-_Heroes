import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('react-router-dom') || id.includes('react-dom') || id.includes(`${'/'}react${'/'}`)) {
            return 'react'
          }

          if (id.includes('framer-motion')) {
            return 'motion'
          }

          if (id.includes('jspdf')) {
            return 'pdf'
          }

          if (id.includes('axios')) {
            return 'network'
          }

          return 'vendor'
        },
      },
    },
  },
})
