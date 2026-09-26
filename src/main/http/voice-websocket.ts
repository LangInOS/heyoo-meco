/**
 * Voice WebSocket Proxy Path
 *
 * Runs inside the main HTTP server and proxies `/voice/asr` connections
 * to the upstream provider. Clients (Capacitor renderer) connect with:
 *
 *   wss://<server>/voice/asr?target=<upstreamWsUrl>&apiKey=<key>&sourceId=<id>&token=<authToken>
 *
 * The proxy validates the token, resolves the real key for `sourceId` (the
 * config API masks secrets for remote clients), injects
 * `Authorization: Bearer <apiKey>` on the upstream leg, and bidirectionally
 * forwards frames.
 */

import { WebSocket, WebSocketServer, WebSocketClient } from 'ws'
import { IncomingMessage } from 'http'
import { Duplex } from 'stream'
import { validateToken } from './auth/index'
import { handleVoiceProxyConnection } from '../services/voice-proxy.service'

let voiceWss: WebSocketServer | null = null

/**
 * Attach the voice proxy path to an existing HTTP server.
 *
 * Uses `noServer` mode so the HTTP server's 'upgrade' event is routed by
 * `handleVoiceWsUpgrade` in server.ts. See `websocket.ts` for why the
 * `server` option can't be used with multiple WebSocketServer instances.
 */
export function initVoiceWebSocket(): void {
  if (voiceWss) {
    console.warn('[VoiceWS] Already initialized')
    return
  }

  voiceWss = new WebSocketServer({
    noServer: true,
    // Ping/pong keeps the TCP connection alive through NAT/firewall idle
    // timeouts on mobile networks. The audio stream itself provides traffic,
    // but the initial setup and any silent gaps still benefit from a heartbeat.
    pingInterval: 30000,
    pingTimeout: 10000,
  })

  // Log server-level errors (protocol violations, etc.) without crashing
  // the main process.
  voiceWss.on('error', (err) => {
    console.error('[VoiceWS] Server error:', err)
  })

  voiceWss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // Token comes from the query string — the renderer immediately sends
    // StepFun protocol frames after open, not a separate auth message.
    let token: string | null = null
    try {
      const parsed = new URL(req.url || '/', 'http://localhost')
      token = parsed.searchParams.get('token')
    } catch { /* ignore */ }

    if (!token || !validateToken(token)) {
      console.log('[VoiceWS] Auth failed — missing/invalid token')
      try { ws.close(1008, 'authentication-required') } catch {}
      return
    }

    console.log('[VoiceWS] Client authenticated')
    handleVoiceProxyConnection(ws as WebSocketClient, { url: req.url })
  })

  console.log('[VoiceWS] Path /voice/asr initialized')
}

/**
 * Route an HTTP 'upgrade' request to this WebSocket server.
 * Called by the single upgrade handler in server.ts for `/voice/asr` paths.
 */
export function handleVoiceWsUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer
): void {
  if (!voiceWss) return
  voiceWss.handleUpgrade(req, socket, head, (ws, request) => {
    voiceWss?.emit('connection', ws, request)
  })
}

/**
 * Shut down the voice proxy path.
 */
export function shutdownVoiceWebSocket(): void {
  if (voiceWss) {
    try {
      for (const client of Array.from(voiceWss.clients)) {
        try { client.close() } catch {}
      }
      voiceWss.close()
    } catch (err) {
      console.error('[VoiceWS] Error closing server:', err)
    }
    voiceWss = null
    console.log('[VoiceWS] Shut down')
  }
}
