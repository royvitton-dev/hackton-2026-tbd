import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Keep public dependency URLs on their package symlinks. The shared park
  // router deliberately rejects hidden directories such as pnpm's .pnpm store.
  resolve: { preserveSymlinks: true },
  server: { host: '127.0.0.1', port: 5175, strictPort: true },
})
