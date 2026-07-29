// RealtimeOverlay - mounts the DigitalHuman above the input box during
// an active realtime conversation.
//
// Position: absolutely placed above the input area. The parent (ChatView)
// renders this as a sibling of InputArea so it floats over chat content
// near the bottom of the viewport. On mobile it sits centered; on desktop
// it shifts to align with the input box width.
//
// Visibility: hidden entirely when `state` is 'idle' or 'disconnected' -
// the digital human only appears when a session is active.
//
// Text streaming: while the AI is responding, `streamingText` is shown in
// a small bubble below the digital human. This gives the user a parallel
// text channel alongside the voice (useful for accessibility and review).

import { useTranslation } from '../../../i18n'
import { DigitalHuman } from './DigitalHuman'
import type { RealtimeConversationState } from '../types'

export interface RealtimeOverlayProps {
  state: RealtimeConversationState
  micAmplitude: number
  speakerAmplitude: number
  /** Accumulated AI text for the current response turn (empty if not responding). */
  streamingText: string
}

export function RealtimeOverlay({
  state,
  micAmplitude,
  speakerAmplitude,
  streamingText,
}: RealtimeOverlayProps) {
  const { t } = useTranslation()
  const visible = state !== 'idle' && state !== 'disconnected'

  if (!visible) return null

  // State label shown next to the digital human for clarity.
  const stateLabel: Record<RealtimeConversationState, string> = {
    idle: '',
    connecting: t('Connecting…'),
    listening: t('Listening…'),
    thinking: t('Thinking…'),
    speaking: t('Speaking…'),
    error: t('Connection error'),
    disconnected: '',
  }

  // Sizes: smaller on mobile to leave room for the input.
  const size = 64

  return (
    <div
      className="pointer-events-none absolute right-4 bottom-full mb-1 sm:mb-2 sm:right-[max(3rem,calc(50%-21rem))] flex flex-col items-end gap-1"
      aria-live="polite"
    >
      <DigitalHuman
        state={state}
        micAmplitude={micAmplitude}
        speakerAmplitude={speakerAmplitude}
        size={size}
      />
      <span className="text-[10px] sm:text-xs text-muted-foreground px-2 py-0.5 rounded-md bg-muted/40 backdrop-blur-sm">
        {stateLabel[state]}
      </span>
      {streamingText && (
        <div
          className="pointer-events-auto max-w-[80vw] sm:max-w-md max-h-32 overflow-y-auto px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground shadow-sm"
          // Truncate to last ~400 chars so the bubble doesn't grow unbounded.
          // The chat history is not persisted - this is a live transcript view.
        >
          {streamingText.slice(-400)}
        </div>
      )}
    </div>
  )
}
