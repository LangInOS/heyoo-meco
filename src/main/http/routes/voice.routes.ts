/**
 * Voice HTTP routes.
 *
 * `/voice/asr/sse` — record-then-transcribe proxy for remote clients
 * (Capacitor). The StepFun SSE endpoint requires the real API key, which the
 * config API masks ('***') for remote clients since credentials are no longer
 * handed to remote-token holders. The client therefore posts the recorded
 * audio here; this route validates the access token, resolves the real key
 * from the local config by sourceId, forwards to the allowlisted upstream,
 * and streams the SSE response back verbatim.
 *
 * The WebSocket voice path (/voice/asr, voice-websocket.ts) mirrors this
 * server-side key resolution for streaming transcription.
 */
import type { Express, Request, Response } from 'express'
import { validateToken } from '../auth'
import { getConfig } from '../../foundation/config.service'
import { proxyFetch } from '../../services/proxy-fetch'
import { isAllowedUpstreamTarget } from '../../services/voice-proxy.service'

export function registerVoiceRoutes(app: Express): void {
  app.post('/voice/asr/sse', async (req: Request, res: Response) => {
    const { token, sourceId, target } = req.query as Record<string, string | undefined>

    if (!token || !validateToken(token)) {
      res.status(401).json({ error: 'authentication-required' })
      return
    }
    if (!target || !isAllowedUpstreamTarget(target)) {
      res.status(400).json({ error: 'invalid-target' })
      return
    }
    const apiKey = sourceId
      ? getConfig().aiSources?.sources?.find(source => source.id === sourceId)?.apiKey
      : undefined
    if (!apiKey) {
      res.status(404).json({ error: 'voice-source-not-found' })
      return
    }

    console.log(`[Voice] SSE proxy: forwarding transcription for source ${sourceId}`)

    try {
      const upstream = await proxyFetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(req.body ?? {}),
      })

      res.status(upstream.status)
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/event-stream')

      if (!upstream.body) {
        res.end()
        return
      }

      // Stream the SSE events through untouched; parsing stays client-side.
      const reader = upstream.body.getReader()
      let clientGone = false
      req.on('close', () => { clientGone = true })
      while (!clientGone) {
        const { done, value } = await reader.read()
        if (done) break
        if (!res.write(Buffer.from(value))) {
          await new Promise<void>(resolve => res.once('drain', resolve))
        }
      }
      if (clientGone) reader.cancel().catch(() => {})
      res.end()
    } catch (err) {
      console.error('[Voice] SSE proxy failed:', (err as Error).message)
      if (!res.headersSent) {
        res.status(502).json({ error: 'upstream-unreachable' })
      } else {
        res.end()
      }
    }
  })

  console.log('[HTTP] Voice routes registered')
}
