/**
 * TTS 语音播报功能模块
 *
 * 结构对称于 features/voice/（STT）：
 * - useTTS hook：管理 TTS 会话生命周期（speak/stop/pause/resume）
 * - TTSButton：消息底部播放按钮（嵌入 MessageItem）
 * - TTSPanel：高级设置面板（嵌入 AdvancedSection）
 *
 * 与 STT 的对称关系：
 * - STT useVoiceSTT：读 VoiceConfig → 调用 startStepFunSTT → 文本回调
 * - TTS useTTS：读 TTSConfig → 调用 startStepFunTTS → 音频播放
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Mic, ChevronDown, ChevronUp, AlertCircle, Volume2, VolumeX, Loader2, Play, Pause } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { useAppStore } from '../../stores/app.store'
import { isCapacitor, getRemoteServerUrl, getAuthToken } from '../../api/transport'
import type { TTSConfig } from '../../types'
import type { AISourcesConfig } from '../../types'
import { stripMarkdownForTTS } from './text-processor'
import { startStepFunTTS } from './adapters/stepfun-tts'
import type { TTSSession } from './adapters/stepfun-tts'
import { startDashScopeTTS } from './adapters/dashscope-tts'
import { ttsController } from './controller'
import type { TTSSessionState } from './controller'
import { subscribeTTSAutoPlay } from './auto-play'

// ── TTS-capable provider registry ────────────────────────────────────
// 与 STT 的 VOICE_CAPABLE_PROVIDERS 对称，但记录 TTS 端点和模型

interface TTSVoice {
  id: string       // 音色 ID（传给 API）
  labelKey: string // i18n key（显示名称，在 UI 层用 t() 翻译）
}

interface TTSCapableProvider {
  wsUrl: string          // WebSocket 流式端点
  ttsModels: string[]
  defaultTtsModel: string
  voices?: TTSVoice[]    // 可选声音列表（带 i18n key）
  /** 是否需要走主进程代理（注入 Authorization header） */
  needsProxy?: boolean
}

const TTS_CAPABLE_PROVIDERS: Record<string, TTSCapableProvider> = {
  stepfun: {
    // WebSocket 流式 TTS（Step Plan 路径）
    wsUrl: 'wss://api.stepfun.com/step_plan/v1/realtime/audio?model=stepaudio-2.5-tts',
    ttsModels: ['stepaudio-2.5-tts'],
    defaultTtsModel: 'stepaudio-2.5-tts',
    // StepFun 官方音色 ID（经 GET /v1/audio/system_voices?model=stepaudio-2.5-tts 验证可用）
    voices: [
      { id: 'cixingnansheng',   labelKey: 'Voice: Magnetic Male' },
      { id: 'wenrounvsheng',    labelKey: 'Voice: Gentle Female' },
      { id: 'wenrounansheng',   labelKey: 'Voice: Gentle Male' },
      { id: 'linjiajiejie',     labelKey: 'Voice: Girl Next Door' },
      { id: 'zixinnansheng',    labelKey: 'Voice: Confident Male' },
      { id: 'jilingshaonv',     labelKey: 'Voice: Clever Girl' },
      { id: 'ruyananshi',       labelKey: 'Voice: Elegant Gentleman' },
      { id: 'boyinnansheng',    labelKey: 'Voice: Broadcaster Male' },
    ],
    needsProxy: true,  // StepFun 需 Authorization header，浏览器 WebSocket 无法设置
  },
  aliyun: {
    // DashScope CosyVoice（与 STT 同一端点，subprotocol 认证，无需代理）
    wsUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/inference',
    ttsModels: ['cosyvoice-v2', 'cosyvoice-v3-plus', 'cosyvoice-v3-flash'],
    defaultTtsModel: 'cosyvoice-v2',
    // CosyVoice 系统音色（来自官方音色列表文档）
    voices: [
      { id: 'longyan',          labelKey: 'Voice: Longyan · Standard Male' },
      { id: 'longanyang',       labelKey: 'Voice: Long Anyang · Sunny Boy' },
      { id: 'longanhuan',       labelKey: 'Voice: Long Anhuan · Cheerful Girl' },
      { id: 'longhuhu_v3',      labelKey: 'Voice: Long Huhu · Child Voice' },
      { id: 'longpaopao_v3',    labelKey: 'Voice: Long Paopao · Bubble Voice' },
    ],
    needsProxy: false,  // DashScope 用 subprotocol 认证，浏览器直连
  },
}

export function isTTSCapableProvider(provider: string): boolean {
  return provider in TTS_CAPABLE_PROVIDERS
}

export function createDefaultTTSConfig(): TTSConfig {
  return {
    sourceId: null,
    ttsModel: '',
    voice: 'cixingnansheng',  // 默认磁性男生
    autoPlay: false,
    speed: 1.0,
  }
}

// ── TTS state ─────────────────────────────────────────────────────────

export type TTSState = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

// ── useTTS hook ───────────────────────────────────────────────────────
// 通过 ttsController 单例管理 session，保证全局只有一个活跃播放

export function useTTS() {
  const ttsConfig = useAppStore(state => state.config?.tts)
  const aiSources = useAppStore(state => state.config?.aiSources)
  const [state, setState] = useState<TTSState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)

  // 订阅 controller 状态变化（来自其他实例的操作也会同步到本实例的 UI）
  useEffect(() => {
    return ttsController.subscribe(({ messageId, state: controllerState }) => {
      setPlayingMessageId(messageId)
      setState(controllerState as TTSState)
    })
  }, [])

  // 解析选中的 AISource 及其 TTS provider 元信息
  const resolved = useMemo(() => {
    if (!ttsConfig?.sourceId || !aiSources) return null
    const source = aiSources.sources.find(s => s.id === ttsConfig.sourceId)
    if (!source?.apiKey) return null
    const providerMeta = TTS_CAPABLE_PROVIDERS[source.provider]
    if (!providerMeta) return null
    return { source, providerMeta }
  }, [ttsConfig?.sourceId, aiSources])

  const stop = useCallback(() => {
    ttsController.stop()
  }, [])

  const speak = useCallback(async (text: string, messageId: string) => {
    if (!resolved) {
      setError('Please configure a TTS-capable AI source in Advanced settings.')
      setState('error')
      return
    }

    // 剥离 markdown，提取纯文本
    const plainText = stripMarkdownForTTS(text)
    if (!plainText.trim()) {
      setError('No speakable text content.')
      setState('error')
      return
    }

    const { source, providerMeta } = resolved
    const ttsModel = ttsConfig?.ttsModel || providerMeta.defaultTtsModel

    // 公共回调
    const onStateChange = (s: 'idle' | 'loading' | 'playing' | 'paused' | 'ended') => {
      ttsController.setState(s as TTSSessionState)
    }
    const onError = (msg: string) => {
      setError(msg)
      ttsController.setState('error')
    }

    setError(null)

    try {
      let session: TTSSession

      if (source.provider === 'aliyun') {
        // DashScope CosyVoice：subprotocol 认证，浏览器直连无需代理
        session = await startDashScopeTTS({
          apiKey: source.apiKey!,
          model: ttsModel,
          voice: ttsConfig?.voice,
          speed: ttsConfig?.speed,
          text: plainText,
          wsUrl: providerMeta.wsUrl,
          onStateChange,
          onError,
        })
      } else if (source.provider === 'stepfun') {
        // StepFun：需 Authorization header，走主进程代理
        let proxyUrl: string
        if (isCapacitor()) {
          const serverUrl = getRemoteServerUrl()
          if (!serverUrl) {
            setError('Server URL not configured.')
            setState('error')
            return
          }
          const token = getAuthToken()
          if (!token) {
            setError('Not authenticated.')
            setState('error')
            return
          }
          proxyUrl = `${serverUrl.replace(/^http/, 'ws')}/voice/asr?target=${encodeURIComponent(providerMeta.wsUrl)}&apiKey=${encodeURIComponent(source.apiKey!)}&token=${encodeURIComponent(token)}`
        } else {
          const portResp = await window.halo.voiceGetProxyPort()
          if (!portResp.success) {
            setError(portResp.error || 'Voice proxy is not available.')
            setState('error')
            return
          }
          proxyUrl = `ws://127.0.0.1:${(portResp.data as { port: number }).port}/?target=${encodeURIComponent(providerMeta.wsUrl)}&apiKey=${encodeURIComponent(source.apiKey!)}`
        }

        session = await startStepFunTTS({
          apiKey: source.apiKey!,
          model: ttsModel,
          voice: ttsConfig?.voice,
          speed: ttsConfig?.speed,
          text: plainText,
          proxyUrl,
          onStateChange,
          onError,
        })
      } else {
        throw new Error(`TTS for provider "${source.provider}" is not yet supported.`)
      }

      ttsController.setSession(messageId, session)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setState('error')
    }
  }, [resolved, ttsConfig?.ttsModel, ttsConfig?.voice, ttsConfig?.speed])

  const pause = useCallback(() => {
    ttsController.pause()
  }, [])

  const resume = useCallback(() => {
    ttsController.resume()
  }, [])

  return {
    state,
    error,
    playingMessageId,
    speak,
    stop,
    pause,
    resume,
    enabled: !!resolved,
  }
}

// ── TTSAutoPlayer 组件 ────────────────────────────────────────────────
// 无 UI，挂在 ChatView 内，订阅 auto-play 事件 + 读 TTSConfig.autoPlay
// 决定是否在新消息完成后自动播报

export function TTSAutoPlayer() {
  const { speak, enabled } = useTTS()
  const ttsConfig = useAppStore(state => state.config?.tts)
  const autoPlay = ttsConfig?.autoPlay ?? false

  useEffect(() => {
    if (!autoPlay || !enabled) return
    return subscribeTTSAutoPlay(({ content, messageId }) => {
      void speak(content, messageId)
    })
  }, [autoPlay, enabled, speak])

  // 组件卸载（如离开聊天页）时停止所有 TTS 播放
  // TTSAutoPlayer 挂载在 ChatView 内，生命周期与聊天页一致
  useEffect(() => {
    return () => {
      ttsController.stop()
    }
  }, [])

  return null  // 无 UI
}

// ── TTSButton 组件 ────────────────────────────────────────────────────
// 消息底部播放按钮，嵌入 MessageItem

interface TTSButtonProps {
  messageId: string
  content: string
}

export function TTSButton({ messageId, content }: TTSButtonProps) {
  const { t } = useTranslation()
  const { state, speak, stop, pause, resume, playingMessageId, enabled } = useTTS()

  if (!enabled) return null

  const isThisPlaying = playingMessageId === messageId
  const isThisLoading = isThisPlaying && state === 'loading'
  const isThisActive = isThisPlaying && (state === 'playing' || state === 'paused')

  const handleClick = () => {
    if (isThisLoading) return
    if (state === 'playing' && isThisPlaying) {
      pause()
    } else if (state === 'paused' && isThisPlaying) {
      resume()
    } else if (!isThisActive) {
      void speak(content, messageId)
    } else {
      stop()
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isThisLoading}
      className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-all
        ${isThisActive
          ? 'text-primary hover:bg-primary/10'
          : 'text-muted-foreground/60 hover:text-foreground hover:bg-white/5'
        }
        ${isThisLoading ? 'opacity-60 cursor-wait' : ''}
      `}
      title={
        isThisLoading ? t('Loading...') :
        state === 'playing' && isThisPlaying ? t('Pause') :
        state === 'paused' && isThisPlaying ? t('Resume') :
        t('Play audio')
      }
    >
      {isThisLoading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : state === 'playing' && isThisPlaying ? (
        <Pause size={14} />
      ) : state === 'paused' && isThisPlaying ? (
        <Play size={14} />
      ) : (
        <Volume2 size={14} />
      )}
    </button>
  )
}

// ── TTSPanel 组件 ─────────────────────────────────────────────────────
// 高级设置面板，嵌入 AdvancedSection

interface TTSPanelProps {
  tts: TTSConfig | undefined
  onChange: (tts: TTSConfig) => void
}

export function TTSPanel({ tts, onChange }: TTSPanelProps) {
  const { t } = useTranslation()
  const aiSources = useAppStore(state => state.config?.aiSources)
  const [open, setOpen] = useState(false)

  // 从现有 aiSources 中筛选 TTS-capable 的源
  const ttsCapableSources = useMemo(() => {
    if (!aiSources) return []
    return aiSources.sources.filter(
      s => isTTSCapableProvider(s.provider) && !!s.apiKey
    )
  }, [aiSources])

  // 合并默认值
  const defaults = createDefaultTTSConfig()
  const current: TTSConfig = {
    sourceId: tts?.sourceId ?? defaults.sourceId,
    ttsModel: tts?.ttsModel ?? defaults.ttsModel,
    voice: tts?.voice ?? defaults.voice,
    autoPlay: tts?.autoPlay ?? defaults.autoPlay,
    speed: tts?.speed ?? defaults.speed,
  }
  const selectedSource = ttsCapableSources.find(s => s.id === current.sourceId)
  const providerMeta = selectedSource
    ? TTS_CAPABLE_PROVIDERS[selectedSource.provider]
    : null

  const handleSourceChange = (sourceId: string) => {
    const source = ttsCapableSources.find(s => s.id === sourceId)
    const meta = source ? TTS_CAPABLE_PROVIDERS[source.provider] : null
    onChange({
      ...current,
      sourceId,
      ttsModel: meta?.defaultTtsModel ?? current.ttsModel,
      voice: meta?.voices?.[0]?.id ?? '',
    })
  }

  const handleModelChange = (ttsModel: string) => {
    onChange({ ...current, ttsModel })
  }

  const handleVoiceChange = (voice: string) => {
    onChange({ ...current, voice })
  }

  const handleAutoPlayChange = (autoPlay: boolean) => {
    onChange({ ...current, autoPlay })
  }

  const handleSpeedChange = (speed: number) => {
    onChange({ ...current, speed })
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">{t('Voice Broadcast')}</span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-3">
          {ttsCapableSources.length === 0 ? (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="w-3 h-3 shrink-0 mt-px" />
              <span>
                {t('No TTS-capable AI source found. Add a compatible AI source first.')}
              </span>
            </div>
          ) : (
            <>
              {/* AI Source selector */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {t('AI Source')}
                </label>
                <select
                  value={current.sourceId ?? ''}
                  onChange={(e) => handleSourceChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">{t('Select...')}</option>
                  {ttsCapableSources.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.provider}
                    </option>
                  ))}
                </select>
              </div>

              {/* TTS Model */}
              {selectedSource && providerMeta && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {t('Broadcast Model')}
                  </label>
                  <select
                    value={current.ttsModel || providerMeta.defaultTtsModel}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {providerMeta.ttsModels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Voice */}
              {selectedSource && providerMeta?.voices && providerMeta.voices.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {t('Voice')}
                  </label>
                  <select
                    value={current.voice ?? 'default'}
                    onChange={(e) => handleVoiceChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {providerMeta.voices.map(v => (
                      <option key={v.id} value={v.id}>{t(v.labelKey)}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Speed */}
              {selectedSource && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {t('Speech Rate')}: {current.speed?.toFixed(1)}x
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={current.speed ?? 1.0}
                    onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              )}

              {/* Auto-play */}
              {selectedSource && (
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <div className="text-sm font-medium">{t('Auto-broadcast replies')}</div>
                    <div className="text-xs text-muted-foreground">
                      {t('Automatically play assistant replies as audio after completion.')}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={current.autoPlay ?? false}
                    onClick={() => handleAutoPlayChange(!(current.autoPlay ?? false))}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      (current.autoPlay ?? false) ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform ${
                      (current.autoPlay ?? false) ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
