/**
 * StepFun TTS 流式适配器 — 文本转语音（WebSocket 流式）
 *
 * API 文档（Step Plan 路径）：
 * - 流式语音合成：wss://api.stepfun.com/step_plan/v1/realtime/audio?model=stepaudio-2.5-tts
 * - 返回流式音频 chunks（wav/pcm），边合成边播放，低延迟
 *
 * 协议流程：
 * 1. 连接 WebSocket（Authorization header 由主进程代理注入）
 * 2. 收到 `tts.connection.done` 事件 → 发送 `tts.create` 配置音色/格式
 * 3. 发送 `tts.text` 事件 → 传入要合成的文本
 * 4. 服务器返回 `tts.audio` 事件（base64 PCM chunks）
 * 5. 用 TTSPlayback 流式播放
 * 6. 收到 `tts.text.done` → 合成完成
 *
 * 与 STT 的对称关系：
 * - STT：音频 in → /realtime/asr/stream → 文本 out
 * - TTS：文本 in → /realtime/audio    → 音频 out
 * - 两者都通过主进程 WebSocket 代理（注入 Authorization header）
 */

import { TTSPlayback } from '../playback'

export interface StepFunTTSOptions {
  apiKey: string
  model: string
  voice?: string
  instruction?: string  // 风格指令，如"语气温柔，语速偏慢"
  speed?: number        // 播放速度（通过 playbackRate 实现）
  text: string
  /** 代理 URL（由 useTTS 传入，与 STT 共用同一个代理） */
  proxyUrl: string
  sampleRate?: number   // 默认 24000
  onStateChange?: (state: 'idle' | 'loading' | 'playing' | 'paused' | 'ended') => void
  onError: (message: string) => void
  onEnd?: () => void
}

export interface TTSSession {
  stop: () => void
  pause: () => void
  resume: () => void
}

const DEFAULT_SAMPLE_RATE = 24000

/**
 * base64 → Int16Array
 */
function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64)
  const len = binary.length / 2
  const buf = new Int16Array(len)
  for (let i = 0; i < len; i++) {
    buf[i] = (binary.charCodeAt(i * 2 + 1) << 8) | binary.charCodeAt(i * 2)
  }
  return buf
}

/**
 * 启动 StepFun TTS 流式会话
 * - 通过代理连接 WebSocket（代理注入 Authorization header）
 * - 发送文本，接收流式 PCM 音频
 * - 用 TTSPlayback 实时播放
 */
export async function startStepFunTTS(
  opts: StepFunTTSOptions
): Promise<TTSSession> {
  const {
    apiKey,      // eslint-disable-line @typescript-eslint/no-unused-vars
    model,       // eslint-disable-line @typescript-eslint/no-unused-vars
    voice: rawVoice,
    instruction,
    speed = 1.0,
    text,
    proxyUrl,
    sampleRate = DEFAULT_SAMPLE_RATE,
    onStateChange,
    onError,
    onEnd,
  } = opts

  // 空字符串也算未设置，统一回退到默认音色
  const voice = rawVoice || 'cixingnansheng'

  if (!text.trim()) throw new Error('Text is empty, nothing to synthesize')
  if (!proxyUrl) throw new Error('Proxy URL is required for TTS')

  const playback = new TTSPlayback({
    sampleRate,
    onStateChange,
    onEnd,
  })

  let ws: WebSocket | null = null
  let stopped = false
  let sessionId: string | null = null

  const sendJson = (obj: unknown) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj))
    }
  }

  const cleanup = () => {
    stopped = true
    if (ws) {
      try { ws.close(1000) } catch {}
      ws = null
    }
    playback.dispose()
  }

  onStateChange?.('loading')

  console.log('[voice-tts] StepFun WebSocket proxy URL:', proxyUrl)
  ws = new WebSocket(proxyUrl)

  ws.onopen = () => {
    console.log('[voice-tts] WebSocket connected, waiting for tts.connection.done')
    // 等待服务器发送 tts.connection.done 后再发送配置
  }

  ws.onmessage = async (event) => {
    if (stopped) return
    try {
      const rawText = typeof event.data === 'string'
        ? event.data
        : await (event.data as Blob).text()
      const msg = JSON.parse(rawText)
      const type = msg?.type as string | undefined

      console.log('[voice-tts] Event:', type, JSON.stringify(msg).slice(0, 500))

      // 1. 连接建立 → 发送配置
      if (type === 'tts.connection.done') {
        sessionId = msg?.data?.session_id
        console.log('[voice-tts] Connection done, session:', sessionId)

        const createMsg = {
          type: 'tts.create',
          data: {
            session_id: sessionId,
            voice_id: voice,
            // 返回裸 PCM（非 wav/mp3）— 每个 chunk 直接是 Int16 样本，
            // 避免 WAV 文件头被当作音频样本产生"突突突"噪音
            response_format: 'pcm',
            volume_ratio: 1.0,
            speed_ratio: speed,
            sample_rate: sampleRate,
            ...(instruction ? { instruction } : {}),
          },
        }
        console.log('[voice-tts] -> tts.create voice_id:', voice)
        sendJson(createMsg)

        // 2. 发送要合成的文本（官方事件类型为 tts.text.delta）
        sendJson({
          type: 'tts.text.delta',
          data: {
            session_id: sessionId,
            text,
          },
        })

        // 3. 标记文本发送完成
        sendJson({
          type: 'tts.text.done',
          data: {
            session_id: sessionId,
          },
        })
        return
      }

      // 4. 接收音频 chunk（官方事件类型为 tts.response.audio.delta）
      if (type === 'tts.response.audio.delta' || type === 'tts.audio') {
        const audioBase64 = msg?.data?.audio as string | undefined
        if (audioBase64) {
          const pcm = base64ToInt16(audioBase64)
          playback.enqueue(pcm)
        }
        return
      }

      // 5. 合成完成（官方事件类型为 tts.response.audio.done）
      if (type === 'tts.response.audio.done' || type === 'tts.response.done') {
        console.log('[voice-tts] Response done, marking input end')
        // 标记上游数据结束，让 playback 播完剩余缓冲后自然结束
        playback.markInputEnd()
        return
      }

      // 6. 错误（两种错误事件类型）
      if (type === 'error' || type === 'tts.response.error') {
        const err = msg.error as { message?: string; code?: string } | undefined
          ?? msg.data as { message?: string; code?: string } | undefined
        const message = err?.message
          ? `${err.message}${err.code ? ` (code: ${err.code})` : ''}`
          : `TTS error: ${JSON.stringify(msg).slice(0, 300)}`
        console.error('[voice-tts] Error event:', msg)
        onError(message)
        cleanup()
        return
      }
    } catch (err) {
      console.error('[voice-tts] Failed to parse message:', err)
    }
  }

  ws.onerror = (event) => {
    console.error('[voice-tts] WebSocket error event:', event)
    onError('WebSocket connection failed. Check the AI Source API key.')
    cleanup()
  }

  ws.onclose = (event) => {
    console.log('[voice-tts] WebSocket closed:', event.code, event.reason)
    if (!stopped) {
      // WebSocket 关闭 ≠ 播放完成，缓冲里可能还有音频
      // 标记输入结束，让 playback 播完剩余缓冲后自然触发 ended
      playback.markInputEnd()
    }
  }

  return {
    stop: () => {
      cleanup()
    },
    pause: () => {
      playback.pause()
    },
    resume: () => {
      playback.resume()
    },
  }
}
