import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Safely get config with fallback for build-time
// The config loader has built-in error handling, but we add an extra safety layer
let viteConfig = null;
try {
  const { getConfig } = await import('./config/loader.js');
  viteConfig = getConfig('vite');
} catch (error) {
  // Fallback if config loader fails during build (e.g., in Docker/CI)
  // This is safe because server proxy config is only needed during dev
  viteConfig = {
    server: {
      proxy: {
        api: {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
}

export default defineConfig({
  // Relative asset URLs: the server sets <base href> so the build works under any base path.
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: viteConfig?.server?.proxy?.api?.target || 'http://localhost:3001',
        changeOrigin: viteConfig?.server?.proxy?.api?.changeOrigin !== false,
      },
    },
  },
})

