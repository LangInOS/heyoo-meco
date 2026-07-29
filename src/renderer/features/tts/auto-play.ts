/**
 * TTS 自动播报触发器
 *
 * 设计动机：
 * - agent-events.ts 是 Zustand store 的纯数据层，不能调用 React hook（useTTS）
 * - 自动播报需要在"消息完成"时触发，这个时机点在 store 内部
 * - 解法：用一个模块级事件总线，store 完成后 emit 事件，
 *   外层 React 组件（ChatView）订阅后调用 useTTS().speak()
 *
 * 这个文件只导出一个最小事件总线，不包含任何 React 代码，
 * 因此可被 store 和 React 组件同时安全引用。
 */

export interface TTSAutoPlayEvent {
  conversationId: string
  messageId: string
  content: string
}

type Listener = (event: TTSAutoPlayEvent) => void

const listeners = new Set<Listener>()

/**
 * 由 agent-events.ts 在消息完成时调用
 */
export function emitTTSAutoPlay(event: TTSAutoPlayEvent): void {
  listeners.forEach(fn => {
    try { fn(event) } catch {}
  })
}

/**
 * 由 React 组件在 mount 时订阅
 */
export function subscribeTTSAutoPlay(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
