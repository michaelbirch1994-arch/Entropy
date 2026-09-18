import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import gw2SkillsImportHandler from './api/gw2skills-import.js'

const gw2SkillsImportDevApi: Plugin = {
  name: 'entropy-gw2skills-import-dev-api',
  configureServer(server) {
    server.middlewares.use('/api/gw2skills-import', async (request, response, next) => {
      const url = new URL(request.url ?? '', 'http://localhost')
      const apiResponse = {
        setHeader(name: string, value: string) { response.setHeader(name, value) },
        status(code: number) { response.statusCode = code; return apiResponse },
        json(value: unknown) {
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify(value))
        },
      }
      try {
        await gw2SkillsImportHandler(
          { method: request.method, query: { url: url.searchParams.get('url') } },
          apiResponse,
        )
      } catch (error) {
        next(error as Error)
      }
    })
  },
}

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/Entropy/' : './',
  plugins: [react(), tailwindcss(), gw2SkillsImportDevApi],
  test: {
    include: [
      'src/**/*.test.{ts,tsx}',
      'api/**/*.test.js',
      'scripts/**/*.test.ts',
    ],
  },
  server: {
    watch: {
      ignored: ['**/.tmp/**'],
    },
  },
})
