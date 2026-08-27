import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { integrationsConnectPlugin } from './vite.integrations'

const LOCAL_API = 'http://localhost:8090'
const RENDER_API = 'https://blink-backend-af7x.onrender.com'

function localBackendUp(ms = 250): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port: 8090, host: '127.0.0.1' })
    const finish = (up: boolean) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(up)
    }
    socket.setTimeout(ms)
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    socket.once('timeout', () => finish(false))
  })
}

function forward(base: string, req: IncomingMessage, res: ServerResponse) {
  const dest = new URL(req.url ?? '/', base)
  const lib = dest.protocol === 'https:' ? https : http
  const headers = { ...req.headers, host: dest.host }
  delete headers.connection
  const upstream = lib.request(dest, { method: req.method, headers }, (up: IncomingMessage) => {
    res.writeHead(up.statusCode ?? 502, up.headers)
    up.pipe(res)
  })
  upstream.on('error', (err: Error) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' })
      res.end(err.message)
    }
  })
  req.pipe(upstream)
}

function apiFallbackProxy(): Plugin {
  return {
    name: 'api-fallback-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api')) {
          next()
          return
        }
        void localBackendUp().then((up) => {
          forward(up ? LOCAL_API : RENDER_API, req, res)
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), integrationsConnectPlugin(), apiFallbackProxy()],
  server: {
    port: 5173,
  },
})
