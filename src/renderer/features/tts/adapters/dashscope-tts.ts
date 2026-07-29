/**
 * DashScope (阿里云百炼) CosyVoice 流式 TTS 适配器
 *
 * API 文档：
 * - WebSocket 端点：wss://dashscope.aliyuncs.com/api-ws/v1/inference（与 STT 相同）
 * - 模型：cosyvoice-v2 / cosyvoice-v3-plus / cosyvoice-v3-flash 等
 * - Auth：WebSocket subprotocol ["bearer", apiKey]（与 STT 对称，浏览器直连无需代理）
 *
 * 协议流程：
 * 1. 建立 WebSocket 连接（subprotocol 认证）
 * 2. 发送 run-task → 收到 task-started
 * 3. 发送 continue-task（文本）→ 收到 result-generated + binary 音频帧
 * 4. 发送 finish-task → 收到 task-finished
 * 5. 关闭连接
 *
 * 与 StepFun TTS 的区别：
 * - 认证：subprotocol（无需代理）vs Authorization header（需代理）
 * - 音频：binary 帧原始 PCM vs base64 编码 PCM
 * - 事件：DashScope header.action 模式 vs StepFun type 模式
 *
 * 与 STT 的对称关系：
 * - STT：音频 in → run-task(ASR) → continue-task(音频) → text out
 * - TTS：text in → run-task(TTS) → continue-task(文本) → 音频 out
 * - 同一端点，同一认证方式，不同 task/function
 */

import { TTSPlayback } from '../playback'

export interface DashScopeTTSOptions {
  apiKey: string
  model: string
  voice?: string
  instruction?: string  // 指令控制（情感/方言/角色），仅部分模型支持
  speed?: number        // 语速 0.5~2.0，默认 1.0
  text: string
  /** WebSocket 端点 URL（与 STT 相同） */
  wsUrl: string
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
const DEFAULT_VOICE = 'longyan'  // 龙小岩 - 标准男声

/**
 * ArrayBuffer → Int16Array
 */
function bufferToInt16(buf: ArrayBuffer): Int16Array {
  return new Int16Array(buf)
}

/**
 * 启动 DashScope CosyVoice 流式 TTS 会话
 */
export async function startDashScopeTTS(
  opts: DashScopeTTSOptions
): Promise<TTSSession> {
  const {
    apiKey,
    model,
    voice: rawVoice,
    instruction,
    speed = 1.0,
    text,
    wsUrl,
    sampleRate = DEFAULT_SAMPLE_RATE,
    onStateChange,
    onError,
    onEnd,
  } = opts

  const voice = rawVoice || DEFAULT_VOICE

  if (!text.trim()) throw new Error('Text is empty, nothing to synthesize')
  if (!wsUrl) throw new Error('WebSocket URL is required for TTS')
  if (!apiKey) throw new Error('API key is required for TTS')

  const playback = new TTSPlayback({
    sampleRate,
    onStateChange,
    onEnd,
  })

  const taskId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  let ws: WebSocket | null = null
  let stopped = false

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

  console.log('[voice-tts] DashScope WebSocket URL:', wsUrl)
  console.log('[voice-tts] DashScope model:', model, 'voice:', voice)

  // 与 STT 对称：用 subprotocol 认证，浏览器直连无需代理
  ws = new WebSocket(wsUrl, ['bearer', apiKey])
  // CosyVoice 通过 binary 通道返回 PCM 音频，需设为 arraybuffer
  ws.binaryType = 'arraybuffer'

  ws.onopen = () => {
    console.log('[voice-tts] DashScope WebSocket connected')

    // 1. 发送 run-task
    const runTask = {
      header: {
        action: 'run-task',
        task_id: taskId,
        streaming: 'duplex',
      },
      payload: {
        task_group: 'audio',
        task: 'tts',
        function: 'SpeechSynthesizer',
        model,
        input: {},
        parameters: {
          text_type: 'PlainText',
          voice,
          format: 'pcm',
          sample_rate: sampleRate,
          rate: speed,
          volume: 50,
          ...(instruction ? { instruction } : {}),
        },
      },
    }
    console.log('[voice-tts] -> run-task voice:', voice)
    sendJson(runTask)
  }

  ws.onmessage = async (event) => {
    if (stopped) return

    // binary 帧 = PCM 音频数据
    if (event.data instanceof ArrayBuffer) {
      const pcm = bufferToInt16(event.data)
      if (pcm.length > 0) {
        playback.enqueue(pcm)
      }
      return
    }

    // Blob 也可能是 binary（某些环境），转 ArrayBuffer
    if (event.data instanceof Blob) {
      const buf = await event.data.arrayBuffer()
      const pcm = bufferToInt16(buf)
      if (pcm.length > 0) {
        playback.enqueue(pcm)
      }
      return
    }

    // text 帧 = JSON 控制消息
    try {
      const msg = JSON.parse(event.data as string)
      const header = msg?.header
      const action = header?.action as string | undefined

      console.log('[voice-tts] DashScope event:', action, JSON.stringify(msg).slice(0, 300))

      // task-started → 发送文本
      if (action === 'task-started') {
        console.log('[voice-tts] Task started, sending text')

        // 2. 发送 continue-task（待合成文本）
        sendJson({
          header: {
            action: 'continue-task',
            task_id: taskId,
            streaming: 'duplex',
          },
          payload: {
            input: { text },
          },
        })

        // 3. 发送 finish-task（通知文本发送完毕）
        sendJson({
          header: {
            action: 'finish-task',
            task_id: taskId,
            streaming: 'duplex',
          },
          payload: {
            input: {},
          },
        })
        return
      }

      // result-generated → 句子级元信息（sentence-begin/synthesis/end）
      if (action === 'result-generated') {
        const outputType = msg?.payload?.output?.type
        if (outputType === 'sentence-synthesis') {
          // 下一个 binary 帧就是该句的音频
        }
        return
      }

      // task-finished → 任务结束
      if (action === 'task-finished') {
        console.log('[voice-tts] Task finished')
        playback.markInputEnd()
        return
      }

      // task-failed → 错误
      if (action === 'task-failed') {
        const errorCode = header?.error_code
        const errorMessage = header?.error_message || 'Unknown DashScope TTS error'
        console.error('[voice-tts] DashScope task failed:', errorCode, errorMessage)
        onError(`${errorMessage}${errorCode ? ` (code: ${errorCode})` : ''}`)
        cleanup()
        return
      }
    } catch (err) {
      console.error('[voice-tts] Failed to parse message:', err)
    }
  }

  ws.onerror = (event) => {
    console.error('[voice-tts] DashScope WebSocket error event:', event)
    onError('WebSocket connection failed. Check the AI Source API key.')
    cleanup()
  }

  ws.onclose = (event) => {
    console.log('[voice-tts] DashScope WebSocket closed:', event.code, event.reason)
    if (!stopped) {
      // WebSocket 关闭 ≠ 播放完成，缓冲里可能还有音频
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
