// WebSocket lifecycle hook for the realtime session.
// Owns the StepFunRealtimeAdapter instance and bridges server events to the
// caller's onEvent callback. Re-entrant: caller can connect/disconnect freely.

import { useCallback, useEffect, useRef, useState } from 'react'
import { StepFunRealtimeAdapter } from '../adapters/stepfun-realtime'
import type { RealtimeSessionConfig, ServerEvent, WsConnectionState } from '../types'

export interface UseRealtimeSessionOptions {
  /** Resolved realtime session config. null = feature not configured. */
  config: RealtimeSessionConfig | null
  /** Local proxy URL (provided by main process). null = main not ready. */
  proxyUrl: string | null
  /** Called for every server event received. */
  onEvent: (event: ServerEvent) => void
}

export interface UseRealtimeSessionResult {
  connectionState: WsConnectionState
  connect: () => void
  disconnect: () => void
  sendAudio: (pcm: ArrayBuffer) => void
  commitInput: () => void
  createResponse: () => void
  sendCancelResponse: () => void
  sendClearInput: () => void
  injectText: (role: 'user' | 'assistant', content: string) => void
  speakText: (text: string) => void
}

export function useRealtimeSession(options: UseRealtimeSessionOptions): UseRealtimeSessionResult {
  const { config, proxyUrl, onEvent } = options
  const adapterRef = useRef<StepFunRealtimeAdapter | null>(null)
  const [connectionState, setConnectionState] = useState<WsConnectionState>('idle')

  // Keep latest onEvent without re-running connect() on every callback change.
  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  })

  const connect = useCallback(() => {
    if (!config || !proxyUrl) return
    // Allow reconnection: close any existing adapter first.
    if (adapterRef.current) {
      adapterRef.current.close()
      adapterRef.current = null
    }

    const adapter = new StepFunRealtimeAdapter({
      proxyUrl,
      config,
      onEvent: (event) => onEventRef.current(event),
      onConnectionChange: (state) => {
        setConnectionState(state)
      },
    })
    adapterRef.current = adapter
    adapter.connect()
  }, [config, proxyUrl])

  const disconnect = useCallback(() => {
    adapterRef.current?.close()
    adapterRef.current = null
    setConnectionState('closed')
  }, [])

  const sendAudio = useCallback((pcm: ArrayBuffer) => {
    adapterRef.current?.sendAudio(pcm)
  }, [])

  const commitInput = useCallback(() => {
    adapterRef.current?.commitInput()
  }, [])

  const sendClearInput = useCallback(() => {
    adapterRef.current?.clearInput()
  }, [])

  const sendCancelResponse = useCallback(() => {
    adapterRef.current?.cancelResponse()
  }, [])

  const createResponse = useCallback(() => {
    adapterRef.current?.createResponse()
  }, [])

  const injectText = useCallback((role: 'user' | 'assistant', content: string) => {
    adapterRef.current?.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role,
        content: [{ type: 'text', text: content }],
      },
    } as any)
  }, [])

  const speakText = useCallback((text: string) => {
    adapterRef.current?.send({
      type: 'response.create',
      response: {
        instructions: `请你朗读：${text}`,
      },
    } as any)
  }, [])

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      adapterRef.current?.close()
      adapterRef.current = null
    }
  }, [])

  return { connectionState, connect, disconnect, sendAudio, commitInput, createResponse, sendCancelResponse, sendClearInput, injectText, speakText }
}
