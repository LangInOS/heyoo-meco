/**
 * TTS 全局控制器 — 模块级单例
 *
 * 设计动机：
 * - useTTS hook 可能被多个 TTSButton 实例 + 自动播器同时使用
 * - 每个 hook 实例有独立的 sessionRef，无法互感知
 * - 解法：把"当前活跃 session"提升到模块级单例
 * - 任何 speak() 调用前，先 stop 旧 session（不管来自哪个 hook 实例）
 *
 * 这样：
 * - 用户点击消息 A 播放 → 开始播放 A
 * - 用户点击消息 B → 自动 stop A，开始播放 B
 * - 自动播报触发 → 自动 stop 手动播放的，开始自动播放
 */

import type { TTSSession } from './adapters/stepfun-tts'

type Listener = (event: { messageId: string | null; state: TTSSessionState }) => void
type TTSSessionState = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error'

class TTSController {
  private session: TTSSession | null = null
  private currentMessageId: string | null = null
  private listeners = new Set<Listener>()

  /** 订阅状态变化（messageId 变化、state 变化） */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  private notify(state: TTSSessionState) {
    this.listeners.forEach(fn => {
      try { fn({ messageId: this.currentMessageId, state }) } catch {}
    })
  }

  /** 当前正在播放/加载的 messageId */
  getActiveMessageId(): string | null {
    return this.currentMessageId
  }

  /**
   * 设置当前会话（由 useTTS.speak 调用）
   * - 会先停止旧会话
   * - 记录 messageId
   */
  setSession(messageId: string, session: TTSSession): void {
    this.stop()
    this.session = session
    this.currentMessageId = messageId
    this.notify('loading')
  }

  /** 更新状态（不更换 session） */
  setState(state: TTSSessionState): void {
    this.notify(state)
    if (state === 'ended' || state === 'error' || state === 'idle') {
      this.session = null
      this.currentMessageId = null
    }
  }

  /** 停止当前会话 */
  stop(): void {
    if (this.session) {
      try { this.session.stop() } catch {}
    }
    this.session = null
    const hadMessage = this.currentMessageId
    this.currentMessageId = null
    if (hadMessage) this.notify('idle')
  }

  pause(): void {
    if (this.session) {
      try { this.session.pause() } catch {}
      this.notify('paused')
    }
  }

  resume(): void {
    if (this.session) {
      try { this.session.resume() } catch {}
      this.notify('playing')
    }
  }
}

export const ttsController = new TTSController()
export type { TTSSessionState }
