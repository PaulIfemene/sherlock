// Dev-only Vite plugin: serves /.netlify/functions/<name> from netlify/functions/<name>.ts, so
// `npm run dev` runs the whole app (site, dashboard and functions) without the Netlify CLI.
// Background functions answer 202 and keep running, as on Netlify.
import type { IncomingMessage } from 'node:http'
import type { Plugin } from 'vite'

const PREFIX = '/.netlify/functions/'

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

export function netlifyFunctions(): Plugin {
  return {
    name: 'sherlock-netlify-functions',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(PREFIX)) return next()
        const url = new URL(req.url, `http://${req.headers.host}`)
        const name = url.pathname.slice(PREFIX.length).replace(/\/$/, '')
        if (!/^[a-z0-9-]+$/.test(name)) return next()
        try {
          const mod = (await server.ssrLoadModule(`/netlify/functions/${name}.ts`)) as { default: (req: Request) => Promise<Response> }
          const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : new Uint8Array(await readBody(req))
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
          const request = new Request(url, { method: req.method, headers, body })
          if (name.endsWith('-background')) {
            res.statusCode = 202
            res.end()
            mod.default(request).catch((err: Error) => server.config.logger.error(`[${name}] ${err.stack ?? err.message}`))
            return
          }
          const response = await mod.default(request)
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          server.config.logger.error(`[${name}] ${(err as Error).stack ?? String(err)}`)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Function crashed in dev; see the terminal.' }))
        }
      })
    },
  }
}
