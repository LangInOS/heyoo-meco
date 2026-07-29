// Digital human visual configuration per conversation state.
// Drives the SVG cartoon humanoid's pose, color, mouth amplitude, and
// whether pulse rings are rendered around it.

import type { RealtimeConversationState } from '../types'

export interface DigitalHumanStateConfig {
  // Primary SVG path for body silhouette. Composed with head + limbs in DigitalHuman.
  // Empty for MVP since pose is encoded directly in the component.
  bodyPath: string
  // Tailwind fill / stroke classes (theme-token based, no hardcoded colors).
  fillClass: string
  strokeClass: string
  // SVG transition duration between states (ms).
  transitionMs: number
  // Mouth amplitude scale (0-1). Higher = more mouth movement for the same audio level.
  mouthAmplitudeScale: number
  // Whether to render pulsing concentric rings around the digital human.
  pulseRings: boolean
  // Ring color class when pulseRings is true.
  ringClass: string
}

// Per-state visual config. The `idle` and `disconnected` states share the
// same look but are kept separate so the component can express "ended"
// without changing color (e.g. fade-out animation could be added later).
export const DIGITAL_HUMAN_STATES: Record<RealtimeConversationState, DigitalHumanStateConfig> = {
  idle: {
    bodyPath: '',
    fillClass: 'fill-muted/20',
    strokeClass: 'stroke-muted-foreground',
    transitionMs: 300,
    mouthAmplitudeScale: 0,
    pulseRings: false,
    ringClass: 'stroke-muted-foreground/30',
  },
  connecting: {
    bodyPath: '',
    fillClass: 'fill-primary/20',
    strokeClass: 'stroke-primary',
    transitionMs: 300,
    mouthAmplitudeScale: 0,
    pulseRings: false,
    ringClass: 'stroke-primary/40',
  },
  listening: {
    bodyPath: '',
    fillClass: 'fill-primary/30',
    strokeClass: 'stroke-primary',
    transitionMs: 200,
    mouthAmplitudeScale: 0.2,
    pulseRings: false,
    ringClass: 'stroke-primary/50',
  },
  thinking: {
    bodyPath: '',
    fillClass: 'fill-muted-foreground/30',
    strokeClass: 'stroke-muted-foreground',
    transitionMs: 200,
    mouthAmplitudeScale: 0,
    pulseRings: false,
    ringClass: 'stroke-muted-foreground/30',
  },
  speaking: {
    bodyPath: '',
    fillClass: 'fill-primary/40',
    strokeClass: 'stroke-primary',
    transitionMs: 100,
    mouthAmplitudeScale: 1.0,
    pulseRings: false,
    ringClass: 'stroke-primary/60',
  },
  error: {
    bodyPath: '',
    fillClass: 'fill-destructive/30',
    strokeClass: 'stroke-destructive',
    transitionMs: 200,
    mouthAmplitudeScale: 0,
    pulseRings: false,
    ringClass: 'stroke-destructive/50',
  },
  disconnected: {
    bodyPath: '',
    fillClass: 'fill-muted/20',
    strokeClass: 'stroke-muted-foreground',
    transitionMs: 300,
    mouthAmplitudeScale: 0,
    pulseRings: false,
    ringClass: 'stroke-muted-foreground/30',
  },
}
