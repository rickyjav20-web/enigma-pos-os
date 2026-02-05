import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ['recharts', 'date-fns', 'lucide-react', 'react-dom/client'],
  },
  server: {
    host: 'localhost',
    port: 4001,
    strictPort: true,
    open: false,
    hmr: {
      host: 'localhost',
      port: 4001
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
