import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Default `/` suits Vercel and most hosts. GitHub Pages can set
  // GITHUB_PAGES=true to serve under /Entropy/.
  base: process.env.GITHUB_PAGES === 'true' ? '/Entropy/' : '/',
  plugins: [react(), tailwindcss()],
})
