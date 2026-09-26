import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * - VITE_BASE: ruta base (en GitHub Pages: /autopuja-subastas/).
 * - VITE_API_URL: URL del backend (vacía = mismo origen).
 * - En desarrollo, /api y /socket.io se redirigen al backend local (puerto 3000).
 * - Tras compilar se copia index.html a 404.html para que GitHub Pages
 *   sirva la SPA en cualquier ruta (recarga de /vehiculo/5, etc.).
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  let salida = resolve('dist')
  return {
    base: env.VITE_BASE || '/',
    plugins: [
      react(),
      {
        name: 'spa-404',
        apply: 'build',
        configResolved(c) {
          salida = resolve(c.root, c.build.outDir)
        },
        closeBundle() {
          try {
            copyFileSync(resolve(salida, 'index.html'), resolve(salida, '404.html'))
          } catch {
            /* sin build */
          }
        },
      },
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://localhost:3000',
        '/socket.io': { target: 'http://localhost:3000', ws: true },
      },
    },
  }
})
