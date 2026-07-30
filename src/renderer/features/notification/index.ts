/**
 * 回复完成通知模块（三端统一入口）
 *
 * 大模型回复完成时，根据运行平台触发不同通知形式：
 * - 提示音：三端通用，playCompleteChime()（Web Audio API 合成，无资源文件）
 * - 系统通知：
 *   - Electron：main 进程 notifyTaskComplete 已在 session-consumer 触发，此处只补 Dock badge + flashFrame
 *   - Web：浏览器 Notification API（需用户授权）
 *   - 手机（Capacitor）：前台时只响提示音+振动；后台已有 LocalNotifications（App.tsx）
 *
 * 设计原则：
 * - 静默失败：通知异常绝不影响主功能
 * - 三端隔离：平台分支用 isCapacitor()/isElectron()/isRemoteClient() 明确区分
 * - 配置门控：受 NotificationConfig.taskComplete 控制
 * - 不过度打扰：用户正在查看该会话时不触发（由调用方 handleAgentComplete 判断）
 */

import { isCapacitor, isElectron, isRemoteClient } from '../../api/transport'
import { playCompleteChime } from '../voice/sound'
import { useNotificationStore } from '../../stores/notification.store'

export interface ReplyNotificationOptions {
  /** 会话标题（用于通知标题区） */
  title: string
  /** 回复内容预览（用于通知正文，截断到约 80 字） */
  preview?: string
  /** 会话 ID（用于点击通知后跳转，Web 端暂未实现跳转） */
  conversationId?: string
  /** 用户是否正在查看该会话（true 时跳过通知，只响提示音） */
  isUserViewing?: boolean
  /** 是否启用通知总开关（来自 config.notifications.taskComplete）
   *  false 时既不响提示音也不弹通知，整体静默 */
  enabled?: boolean
  /** 是否播放提示音（默认与 enabled 一致）。
   *  拆分场景：第一处已响过提示音，第二处只补 toast 时设为 false 避免重复 */
  playSound?: boolean
}

/**
 * 触发"回复完成"通知（提示音 + 系统通知）
 *
 * 三端行为：
 * - Electron：提示音 + Dock badge（macOS）/ flashFrame（Windows）+ 复用已有 main 进程通知
 * - Web：提示音 + 浏览器 Notification（需授权）
 * - Capacitor：前台提示音 + 振动；后台依赖已有 LocalNotifications
 */
export function notifyReplyComplete(opts: ReplyNotificationOptions): void {
  const { title, preview, isUserViewing = false, enabled = true, playSound } = opts
  // playSound 未显式传入时，跟随 enabled
  const shouldPlaySound = playSound ?? enabled

  // 1. 提示音：三端通用
  //    （用户正在查看时也播放，符合"微信回复"体验；若日后想静音可扩展配置）
  if (shouldPlaySound) {
    playCompleteChime()
  }

  // 2. 系统通知：总开关关闭或用户正在查看该会话时不打扰
  if (!enabled || isUserViewing) return

  try {
    if (isCapacitor()) {
      // 手机端：前台振动 + in-app toast；后台由 App.tsx 的 LocalNotifications 处理
      notifyMobileForeground(title, preview)
    } else if (isElectron()) {
      // Electron：窗口未聚焦时 main 进程 notifyTaskComplete 已发 OS 通知 + Dock badge；
      // 窗口聚焦时 main 进程会跳过（macOS 前台应用不弹 OS 通知），此处补 in-app toast
      notifyElectronEnhanced(title, preview)
    } else if (isRemoteClient()) {
      // Web 端：浏览器 Notification API
      void notifyWeb(title, preview)
    }
  } catch {
    // 通知失败不影响主功能
  }
}

// ── 手机端：前台振动 + in-app toast ────────────────────────────────────

function notifyMobileForeground(title: string, preview?: string): void {
  // 1. 振动（Android 支持，iOS 静默无效）
  //    双脉冲 [40, 60, 40]，比语音输入的 stop 振动稍长，区分"消息到达"
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([40, 60, 40])
  }

  // 2. in-app toast：手机端前台切到别的会话/空间/数字人时，也需要视觉提醒
  //    后台时由 App.tsx 的 LocalNotifications 处理，这里不重复
  try {
    useNotificationStore.getState().show({
      title: 'Halo',
      body: preview || title,
      variant: 'default',
      duration: 6000,
    })
  } catch {
    // toast 失败静默处理
  }
}

// ── Electron：窗口聚焦时的 in-app toast ────────────────────────────────
//
// main 进程的 notifyTaskComplete 仅在窗口未聚焦时发 OS 通知 + Dock badge；
// 窗口聚焦时直接 return（macOS 前台应用不弹 OS 通知）。
// 但"窗口聚焦"不等于"用户正在查看该会话"——用户可能在别的会话/页面，
// 此时需要 in-app toast 提醒有新回复，否则除了提示音外没有任何视觉反馈。

function notifyElectronEnhanced(title: string, preview?: string): void {
  // 能进入此函数的前提：isUserViewing=false（用户没在看该会话）。
  // 无论窗口是否聚焦都弹 in-app toast：
  //   - 窗口聚焦：main 进程跳过 OS 通知（前台应用不弹），toast 是唯一的视觉提醒
  //   - 窗口未聚焦：main 进程发 OS 通知 + Dock badge，toast 作为补充（用户切回时也能看到）
  //
  // 注意：会话标题本质是用户第一条消息的前几十个字（非真正标题），与回复预览内容相近，
  // 同时显示会冗余。因此 toast 标题区用固定品牌名，正文只显示回复预览。
  // 后续做"来源区分"时，标题区将换成"空间名/数字人名"。
  try {
    useNotificationStore.getState().show({
      title: 'Halo',
      body: preview || title,   // 优先用回复预览，无预览时回退到会话标题
      variant: 'default',
      duration: 6000,
    })
  } catch {
    // toast 失败静默处理
  }
}

// ── Web 端：浏览器 Notification API ────────────────────────────────────
//
// 浏览器 Notification 需用户授权，且首次需用户手势触发 requestPermission。
// 这里做"尽力而为"：已授权就弹，未授权就跳过（设置页可引导授权）。

async function notifyWeb(title: string, preview?: string): Promise<void> {
  if (typeof Notification === 'undefined') return

  // 未授权直接跳过（不在非用户手势上下文弹权限框，避免骚扰）
  if (Notification.permission !== 'granted') return

  try {
    // 通知正文：优先用回复预览，无预览时回退到会话标题
    const body = preview || title
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'reply-complete',
      silent: true,  // 已用 playCompleteChime 播放提示音，避免双重声音
    })
    // 点击通知聚焦窗口
    n.onclick = () => {
      window.focus()
      n.close()
    }
    // 5 秒后自动关闭
    setTimeout(() => n.close(), 5000)
  } catch {
    // 通知失败静默处理
  }
}

/**
 * 请求浏览器通知权限（需在用户手势上下文调用，如设置页按钮点击）
 * @returns 是否已授权
 */
export async function requestWebNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  try {
    const result = await Notification.requestPermission()
    return result === 'granted'
  } catch {
    return false
  }
}

/**
 * 获取当前浏览器通知权限状态
 */
export function getWebNotificationPermission(): 'default' | 'granted' | 'denied' | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/**
 * 清除通知角标（窗口聚焦时调用）
 */
export function clearNotificationBadge(): void {
  if (isElectron()) {
    const halo = (window as unknown as { halo?: { clearNotificationBadge?: () => Promise<unknown> } }).halo
    void halo?.clearNotificationBadge?.()
  }
}

/**
 * 设置窗口聚焦时自动清除通知角标（Electron 端）
 * 应在 App 初始化时调用一次
 */
export function setupNotificationBadgeClear(): void {
  if (!isElectron()) return
  window.addEventListener('focus', () => {
    clearNotificationBadge()
  }, { once: false })
}
