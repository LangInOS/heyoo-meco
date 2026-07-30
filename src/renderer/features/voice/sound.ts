/**
 * 语音输入反馈工具
 *
 * 提供两类反馈，均按"开始/停止"两种语义区分：
 * - 提示音（playMicBeep）：Web Audio API 实时合成短促音，无音频资源
 *   - start：上升音 660Hz → 880Hz
 *   - stop：下降音 880Hz → 440Hz
 * - 触觉反馈（playMicHaptic）：navigator.vibrate 振动
 *   - start：单次短振 30ms
 *   - stop：双脉冲 [20, 40, 20] 以示结束
 *
 * 平台支持：
 * - 提示音：Electron / 浏览器 / Capacitor WebView 通用
 * - 振动：Android WebView 原生支持；iOS WKWebView 与桌面端不支持，静默无效
 *   未引入 @capacitor/haptics 以避免新增依赖，与项目现有 haptic 实现保持一致
 *   （见 TurnRail.tsx 中的 navigator.vibrate 用法）
 *
 * 设计原则：
 * - 静默失败：反馈异常不影响录音主功能
 * - 资源释放：每次播放创建独立 AudioContext，onended 中 close() 释放
 * - 单一职责：声音与振动函数分离，组合函数 playMicFeedback 统一触发
 */

export type MicFeedbackType = 'start' | 'stop'

/**
 * 播放语音输入提示音
 */
export function playMicBeep(type: MicFeedbackType): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    const now = ctx.currentTime
    if (type === 'start') {
      osc.frequency.setValueAtTime(660, now)
      osc.frequency.linearRampToValueAtTime(880, now + 0.08)
    } else {
      osc.frequency.setValueAtTime(880, now)
      osc.frequency.linearRampToValueAtTime(440, now + 0.08)
    }
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
    osc.start(now)
    osc.stop(now + 0.15)
    osc.onended = () => {
      ctx.close().catch(() => {})
    }
  } catch {
    // 提示音失败不应影响主功能，静默处理
  }
}

/**
 * 触发语音输入触觉反馈（振动）
 * - Android：通过 navigator.vibrate 工作
 * - iOS / 桌面端：不支持，静默无效
 */
export function playMicHaptic(type: MicFeedbackType): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    // start：单次短振；stop：双脉冲以示结束
    const pattern: number | number[] = type === 'start' ? 30 : [20, 40, 20]
    navigator.vibrate(pattern)
  } catch {
    // 振动失败不应影响主功能，静默处理
  }
}

/**
 * 同时触发提示音与振动反馈（推荐入口）
 */
export function playMicFeedback(type: MicFeedbackType): void {
  playMicBeep(type)
  playMicHaptic(type)
}

// ── 消息到达提示音（区别于语音输入反馈音） ──────────────────────────────
//
// 大模型回复完成时播放，三声上升琶音（C5 → E5 → G5），比 mic beep 更柔和悦耳，
// 类似即时通讯应用的"新消息"提示音。
//
// 设计与 playMicBeep 的区别：
// - 三音琶音（而非双音滑动），听感更像"通知"而非"操作反馈"
// - 使用三角波（triangle）而非正弦波，音色更温暖
// - 音量更低（0.08 峰值），避免在专注工作时造成惊吓
// - 总时长约 0.3s，足够引起注意但不冗长

/**
 * 播放消息到达提示音（三声上升琶音）
 */
export function playCompleteChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()

    // C5=523.25, E5=659.25, G5=783.99 — C 大调主和弦琶音，明亮正向
    const notes = [
      { freq: 523.25, start: 0.00, dur: 0.10 },
      { freq: 659.25, start: 0.08, dur: 0.10 },
      { freq: 783.99, start: 0.16, dur: 0.14 },
    ]

    const now = ctx.currentTime
    let lastEnd = 0

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'  // 三角波，比 sine 更温暖
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)

      const t = now + start
      // 简单 ADSR：快速起音 + 指数衰减
      gain.gain.setValueAtTime(0.001, t)
      gain.gain.exponentialRampToValueAtTime(0.08, t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur)

      osc.start(t)
      osc.stop(t + dur)
      lastEnd = Math.max(lastEnd, t + dur)
    })

    // 在最后一个音结束后释放 AudioContext
    setTimeout(() => {
      ctx.close().catch(() => {})
    }, Math.max(0, (lastEnd - now) * 1000 + 100))
  } catch {
    // 提示音失败不影响主功能，静默处理
  }
}
