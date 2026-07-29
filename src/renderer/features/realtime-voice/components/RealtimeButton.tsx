// Speak / End button for the realtime conversation.
//
// Visual states (driven by `state` prop, set by the parent from the
// orchestrator's `conversationState`):
//   idle        -> Sound wave icon, primary theme color (ready to start)
//   connecting  -> Sound wave icon with pulse ring
//   listening   -> Sound wave icon with pulse ring (active conversation, user's turn)
//   thinking    -> Sound wave icon, muted (AI is processing)
//   speaking    -> Sound wave icon, primary (AI is talking - press to barge-in / end)
//   error       -> Alert icon, destructive
//
// When `state` is null the feature is considered not configured and the
// button renders disabled.
//
// The parent (InputArea) decides whether to render this button at all - it
// is only shown when the input box is empty (so Send is hidden anyway) OR
// when a conversation is active (in which case Send is force-hidden).

import { Square, AlertCircle } from 'lucide-react'
import { useTranslation } from '../../../i18n'
import type { RealtimeConversationState } from '../types'

// Sound wave icon — five vertical bars, distinct from the Mic icon.
function SoundWaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-4 h-4">
      <path d="M12 6v12" />
      <path d="M8 9v6" />
      <path d="M16 8v8" />
      <path d="M4 11v2" />
      <path d="M20 10v4" />
    </svg>
  )
}

export interface RealtimeButtonProps {
  /** null = feature not configured. 'idle' = ready. Others = active session. */
  state: RealtimeConversationState | null
  onClick: () => void
  disabled?: boolean
  className?: string
}

export function RealtimeButton({
  state,
  onClick,
  disabled,
  className,
}: RealtimeButtonProps) {
  const { t } = useTranslation()

  const notConfigured = state === null
  const isActive = state !== null && state !== 'idle' && state !== 'disconnected' && state !== 'error'
  const isError = state === 'error'

  // Decide visual variant.
  const variant: 'speak' | 'active' | 'error' = isError
    ? 'error'
    : isActive
      ? 'active'
      : 'speak'

  // Icon + label per variant.
  const Icon = variant === 'error' ? AlertCircle : variant === 'active' ? Square : SoundWaveIcon
  const label = variant === 'error'
    ? t('Error')
    : variant === 'active'
      ? t('End')
      : t('Speak')

  const handleClick = () => {
    if (disabled || notConfigured) return
    console.log('[Realtime] Button clicked, state:', state, 'variant:', variant)
    onClick()
  }

  // Tailwind class composition. All theme-token based, no hardcoded colors.
  const base =
    'inline-flex items-center justify-center rounded-lg transition-colors ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
    'disabled:opacity-50 disabled:cursor-not-allowed ' +
    'w-8 h-8 shrink-0 '

  const variantClass = variant === 'error'
    ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30 '
    : variant === 'active'
      ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 '
      : 'bg-primary text-primary-foreground hover:bg-primary/90 '

  const pulseClass = isActive && (state === 'listening' || state === 'connecting')
    ? 'animate-pulse '
    : ''

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || notConfigured}
      aria-label={label}
      title={label}
      className={base + variantClass + pulseClass + (className ?? '')}
    >
      <SoundWaveIcon />
    </button>
  )
}
