import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { netlifyFunctions } from './scripts/vite-netlify-functions.ts'

export default defineConfig(({ mode }) => {
  // Functions run in-process during dev, so give them the server-side variables from .env too.
  const env = loadEnv(mode, process.cwd(), '')
  for (const [k, v] of Object.entries(env)) process.env[k] ??= v
  // Background functions are triggered in-process, not back through a public tunnel.
  process.env.INTERNAL_BASE_URL ??= 'http://localhost:5173'
  return {
    base: '/',
    plugins: [react(), tailwindcss(), netlifyFunctions()],
    ssr: { external: ['sharp'] },
    // Cloudflare quick tunnels (npm run tunnel) let Green API reach the local webhook.
    server: { port: 5173, strictPort: true, allowedHosts: ['.trycloudflare.com'] },
  }
})
