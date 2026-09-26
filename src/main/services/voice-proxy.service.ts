/**
 * Voice WebSocket Proxy
 *
 * Browser WebSocket does not support custom headers, but StepFun's realtime
 * ASR API requires `Authorization: Bearer <apiKey>`. This tiny local proxy
 * runs in the main process, adds the header on the upstream leg, and
 * bidirectionally forwards messages between the renderer and the provider.
 *
 * Security:
 *   - Listens on 127.0.0.1 only (not reachable from the network).
 *   - Dynamic port allocation (`listen(0)`) avoids collisions.
 *   - Target hostname is validated against an allowlist before connecting.
 *   - Query params (apiKey) never touch disk or logs.
 */

import { WebSocket, WebSocketServer, WebSocketClient } from 'ws'
import { createServer, Server as HttpServer } from 'http'
import { randomUUID } from 'crypto'
import log from 'electron-log/main.js'
import { getConfig } from '../foundation/config.service'

// Hostnames we are willing to proxy to. Prevents open-proxy misuse.
const ALLOWED_UPSTREAM_HOSTS = new Set([
  'api.stepfun.com',
])

/**
 * Validate an upstream voice URL against the proxy allowlist. Shared with the
 * HTTP SSE route (/voice/asr/sse) so both voice paths enforce the same rule.
 */
export function isAllowedUpstreamTarget(url: string): boolean {
  try {
    return ALLOWED_UPSTREAM_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

let server: HttpServer | null = null
let wss: WebSocketServer | null = null
let port: number | null = null

/**
 * Handle a single voice proxy connection.
 * Parses `target` and `apiKey` from the query string, validates the upstream
 * hostname, then bidirectionally pipes frames between the renderer client and
 * the upstream provider (adding `Authorization: Bearer <apiKey>` on the
 * upstream leg).
 */
export function handleVoiceProxyConnection(
  client: WebSocketClient,
  req: { url?: string }
): void {
  const clientId = randomUUID()
  log.info('[VoiceProxy] Renderer connected:', clientId)

  // Parse the target URL from the query string.
  // Expected: /?target=<encodeURIComponent(wsUrl)>&apiKey=<encodeURIComponent(apiKey)>
  let targetUrl: string | null = null
  let apiKey: string | null = null

  try {
    const parsed = new URL(req.url || '/', 'http://localhost')
    targetUrl = parsed.searchParams.get('target')
    apiKey = parsed.searchParams.get('apiKey')

    // Remote clients get masked keys ('***') from the config API, so the
    // Capacitor /voice/asr path passes sourceId and the server resolves the
    // real key from its own config instead of trusting the query param.
    const sourceId = parsed.searchParams.get('sourceId')
    if (sourceId) {
      const resolvedKey = getConfig()
        .aiSources?.sources?.find(source => source.id === sourceId)?.apiKey
      if (resolvedKey) {
        apiKey = resolvedKey
        log.info(`[VoiceProxy] Resolved apiKey server-side for source ${sourceId}`)
      } else {
        log.warn(`[VoiceProxy] sourceId ${sourceId} not found in local config`)
      }
    }

    if (!targetUrl || !apiKey) {
      log.error('[VoiceProxy] Missing target or apiKey in connection URL')
      try { client.close(4001, 'missing-target-or-apikey') } catch {}
      return
    }

    // Validate the target hostname to prevent open-proxy abuse.
    const target = new URL(targetUrl)
    if (!ALLOWED_UPSTREAM_HOSTS.has(target.hostname)) {
      log.error('[VoiceProxy] Blocked upstream to disallowed host:', target.hostname)
      try { client.close(4002, 'host-not-allowed') } catch {}
      return
    }
  } catch (err) {
    log.error('[VoiceProxy] Failed to parse connection URL:', err)
    try { client.close(4003, 'bad-request') } catch {}
    return
  }

  // Connect to the upstream provider with the Authorization header.
  let upstream: WebSocket | null = null
  let closed = false

  const close = (code?: number, reason?: string) => {
    if (closed) return
    closed = true
    try { client.close(code, reason) } catch {}
    try { upstream?.close() } catch {}
  }

  try {
    upstream = new WebSocket(targetUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    upstream.on('open', () => {
      log.info('[VoiceProxy] Upstream connected for client:', clientId)
    })

    upstream.on('message', (data: Buffer, isBinary: boolean) => {
      if (client.readyState === WebSocket.OPEN) {
        // Preserve the frame type: StepFun sends JSON as text frames, but
        // ws.send(buffer) defaults to binary. A binary frame reaches the
        // browser as a Blob, which JSON.parse cannot handle.
        client.send(data, { binary: isBinary })
      }
    })

    upstream.on('error', (err) => {
      log.error('[VoiceProxy] Upstream error for client:', clientId, err.message)
      close(4004, 'upstream-error')
    })

    upstream.on('close', (event) => {
      log.info('[VoiceProxy] Upstream closed for client:', clientId, event.code, event.reason)
      if (client.readyState === WebSocket.OPEN) {
        client.close(event.code, event.reason)
      }
    })
  } catch (err) {
    log.error('[VoiceProxy] Failed to connect upstream:', err)
    close(4005, 'upstream-connect-failed')
    return
  }

  // Renderer -> upstream
  client.on('message', (data: Buffer, isBinary: boolean) => {
    if (upstream && upstream.readyState === WebSocket.OPEN) {
      upstream.send(data, { binary: isBinary })
    }
  })

  client.on('error', (err) => {
    log.error('[VoiceProxy] Renderer client error:', clientId, err.message)
    close(4006, 'client-error')
  })

  client.on('close', () => {
    log.info('[VoiceProxy] Renderer client disconnected:', clientId)
    try { upstream?.close() } catch {}
  })
}

/**
 * Start the proxy. Called once during extended bootstrap.
 * Uses dynamic port allocation so callers must read `getProxyPort()` after init.
 */
export function initVoiceProxy(): void {
  if (server) {
    log.warn('[VoiceProxy] Already initialized')
    return
  }

  server = createServer()
  wss = new WebSocketServer({ server })

  wss.on('connection', (client: WebSocketClient, req: { url?: string }) => {
    handleVoiceProxyConnection(client, req)
  })

  server.listen(0, '127.0.0.1', () => {
    const addr = server!.address()
    if (addr && typeof addr === 'object') {
      port = addr.port
    }
    log.info(`[VoiceProxy] Listening on 127.0.0.1:${port}`)
  })

  server.on('error', (err) => {
    log.error('[VoiceProxy] Server error:', err)
  })
}

/**
 * Return the port the proxy is listening on, or null if not yet initialized.
 */
export function getProxyPort(): number | null {
  return port
}

/**
 * Shut down the proxy. Called during app cleanup.
 */
export function shutdownVoiceProxy(): void {
  if (wss) {
    try {
      wss.clients.forEach((client) => {
        try { client.close() } catch {}
      })
      wss.close()
    } catch (err) {
      log.error('[VoiceProxy] Error closing WebSocketServer:', err)
    }
    wss = null
  }

  if (server) {
    try {
      server.close()
    } catch (err) {
      log.error('[VoiceProxy] Error closing HTTP server:', err)
    }
    server = null
  }

  port = null
  log.info('[VoiceProxy] Shut down')
}
