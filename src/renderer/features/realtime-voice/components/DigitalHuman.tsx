// Digital human - SVG cartoon humanoid.
//
// State-driven visualization:
//   - Head: circle with two eyes (dots), gradient breathing glow
//   - Body: rounded rectangle
//   - Mouth: animated path whose curvature scales with amplitude
//   - Antennas: three lines on head top, different motion per state
//   - Arms: subtle swing that keeps moving during speech pauses
//
// Amplitude comes from the orchestrator hook:
//   - 'listening' -> micAmplitude drives mouth subtly
//   - 'speaking'  -> speakerAmplitude drives mouth prominently
//   - others      -> mouth is neutral (closed)

import { useMemo, useEffect, useState, useRef } from 'react'
import { useTranslation } from '../../../i18n'
import { DIGITAL_HUMAN_STATES } from '../digital-human/states'
import type { RealtimeConversationState } from '../types'

export interface DigitalHumanProps {
  state: RealtimeConversationState
  /** Mic amplitude (0-1). Used during 'listening'. */
  micAmplitude: number
  /** Playback amplitude (0-1). Used during 'speaking'. */
  speakerAmplitude: number
  /** Optional size in px. Defaults to 96 (mobile-friendly). */
  size?: number
}

export function DigitalHuman({
  state,
  micAmplitude,
  speakerAmplitude,
  size = 96,
}: DigitalHumanProps) {
  const { t } = useTranslation()
  const config = DIGITAL_HUMAN_STATES[state]

  // Raw amplitude from mic / speaker.
  const rawAmplitude = state === 'speaking'
    ? speakerAmplitude * config.mouthAmplitudeScale
    : state === 'listening'
      ? micAmplitude * config.mouthAmplitudeScale
      : 0

  // Smoothed amplitude with very slow decay. This keeps mouth / glow
  // animating through normal speech pauses (200-400ms between words) and
  // short gaps between audio chunks, instead of snapping to zero.
  const smoothRef = useRef(0)
  const smoothAmplitude = useMemo(() => {
    const target = Math.min(1, rawAmplitude)
    const prev = smoothRef.current
    // Attack fast, decay very slow (half-life ~1.5s) so pauses don't kill
    // the mouth animation.
    smoothRef.current = target > prev
      ? prev + (target - prev) * 0.55
      : prev + (target - prev) * 0.025
    return smoothRef.current
  }, [rawAmplitude])

  // Continuous animation driver. Always running so idle has a subtle
  // breathing feel and active states never freeze during pauses.
  const [animTime, setAnimTime] = useState(0)
  useEffect(() => {
    let raf: number
    const tick = () => {
      setAnimTime(Date.now() / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // ---- Animation parameters ----

  // Breathing: always present, stronger when active.
  const baseBreathe = Math.sin(animTime * 1.8) * 0.015
  const activeBreathe = (state === 'speaking' || state === 'listening')
    ? Math.sin(animTime * 3.2) * smoothAmplitude * 0.05
    : state === 'thinking'
      ? Math.sin(animTime * 2.4) * 0.025
      : 0
  const breatheScale = 1 + baseBreathe + activeBreathe

  // Head glow: radial overlay behind the head.
  const glowOpacity = state === 'speaking' || state === 'listening'
    ? 0.12 + smoothAmplitude * 0.35
    : state === 'thinking'
      ? 0.12 + Math.sin(animTime * 2.4) * 0.08
      : state === 'idle' || state === 'disconnected'
        ? 0.04 + Math.sin(animTime * 1.8) * 0.03
        : 0
  const glowRadius = 16 + smoothAmplitude * 4

  // Eyes: highlight dots during active states.
  const eyeHighlight = state === 'speaking' || state === 'listening'
    ? 0.5 + smoothAmplitude * 0.9
    : state === 'thinking'
      ? 0.3 + Math.sin(animTime * 2.4) * 0.3
      : 0

  // Antenna definitions (base positions on head top).
  const antennaBases = [
    { x: 38, y: 22 },
    { x: 50, y: 20 },
    { x: 62, y: 22 },
  ]
  // Antenna tips - time-based motion per state, amplitude adds energy.
  const antennaTips = useMemo(() => {
    return antennaBases.map((base, i) => {
      const phase = i * 1.2
      if (state === 'thinking') {
        const sway = Math.sin(animTime * 3 + phase) * 7
        const lift = Math.cos(animTime * 2.5 + phase) * 5
        return {
          x: base.x + sway,
          y: base.y - 10 - Math.abs(lift),
          len: 12 + Math.abs(sway) * 0.5,
        }
      }
      if (state === 'speaking') {
        // Base motion always present; amplitude boosts displacement.
        const baseSway = Math.sin(animTime * 8 + phase) * 4
        const ampBoost = Math.sin(animTime * 12 + phase * 1.5) * smoothAmplitude * 10
        const x = base.x + baseSway + ampBoost * 0.5
        const y = base.y - 8 - Math.abs(ampBoost) * 0.4
        const len = 12 + Math.abs(baseSway) * 0.3 + Math.abs(ampBoost) * 0.5
        return { x, y, len }
      }
      if (state === 'listening') {
        // Gentle sway while listening.
        const sway = Math.sin(animTime * 2 + phase) * 2
        return {
          x: base.x + sway,
          y: base.y - 10,
          len: 12,
        }
      }
      // Idle / error / disconnected: very subtle drift.
      const drift = Math.sin(animTime * 1.2 + phase) * 1.5
      return {
        x: base.x + drift,
        y: base.y - 10,
        len: 12,
      }
    })
  }, [state, smoothAmplitude, animTime])

  // Mouth path: exaggerated open so it reads clearly at 64px.
  const mouthPath = useMemo(() => {
    const cx = 50
    const cy = 44
    const halfW = 7
    const open = Math.min(14, smoothAmplitude * 14)
    if (open < 0.8) {
      return `M ${cx - halfW} ${cy} L ${cx + halfW} ${cy}`
    }
    const bottom = cy + open
    return `M ${cx - halfW} ${cy} Q ${cx} ${bottom} ${cx + halfW} ${cy} Q ${cx} ${cy + open * 0.15} ${cx - halfW} ${cy}`
  }, [smoothAmplitude])

  // Arm swing: always present when not idle/error, amplitude modulates.
  const armSwing = useMemo(() => {
    const phaseL = animTime * 5.5
    const phaseR = animTime * 5.5 + 1
    if (state === 'speaking') {
      const base = Math.sin(phaseL) * 3
      const boost = Math.sin(phaseL * 1.7) * smoothAmplitude * 6
      return {
        left: base + boost,
        right: -(base + Math.sin(phaseR * 1.7) * smoothAmplitude * 6),
      }
    }
    if (state === 'thinking') {
      const sway = Math.sin(animTime * 2) * 2.5
      return { left: sway, right: -sway }
    }
    if (state === 'listening') {
      const sway = Math.sin(animTime * 1.8) * 1.5
      return { left: sway, right: -sway }
    }
    // Idle: very subtle drift.
    const drift = Math.sin(animTime * 1.2) * 0.8
    return { left: drift, right: -drift }
  }, [state, smoothAmplitude, animTime])

  // Two pulse rings, fading outward. Only rendered when config.pulseRings.
  const rings = config.pulseRings ? (
    <>
      <circle
        cx="50"
        cy="36"
        r="20"
        fill="none"
        className={`${config.ringClass} animate-ping`}
        strokeWidth="1.5"
      />
      <circle
        cx="50"
        cy="36"
        r="24"
        fill="none"
        className={`${config.ringClass} animate-pulse`}
        strokeWidth="1"
        opacity="0.6"
      />
    </>
  ) : null

  // Thinking indicator: three dots above the head.
  const thinkingDots = state === 'thinking' ? (
    <g className="fill-muted-foreground animate-pulse">
      <circle cx="38" cy="14" r="2" />
      <circle cx="50" cy="14" r="2" />
      <circle cx="62" cy="14" r="2" />
    </g>
  ) : null

  // ARIA: announce state changes to screen readers.
  const ariaLabel = t('Digital human state: {{state}}', { state })

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={ariaLabel}
      className="transition-all"
      style={{ transitionDuration: `${config.transitionMs}ms`, transform: `scale(${breatheScale})`, transformOrigin: 'center center' }}
    >
      {rings}
      {thinkingDots}

      {/* Antennas */}
      {state !== 'error' && (
        <g className={`${config.strokeClass} fill-none`} strokeWidth="2" strokeLinecap="round">
          {antennaTips.map((tip, i) => (
            <g key={i}>
              <line
                x1={antennaBases[i].x}
                y1={antennaBases[i].y}
                x2={tip.x}
                y2={tip.y}
              />
              <circle cx={tip.x} cy={tip.y} r="1.5" className={config.fillClass} />
            </g>
          ))}
        </g>
      )}

      {/* Arms - dynamic sway driven by state + amplitude. */}
      <path
        d={`M 30 64 Q ${22 + armSwing.left * 0.6} ${70 + Math.abs(armSwing.left) * 0.4} ${22 + armSwing.left} ${78 + Math.abs(armSwing.left) * 0.3}`}
        className={`${config.strokeClass} fill-none`}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d={`M 70 64 Q ${78 + armSwing.right * 0.6} ${70 + Math.abs(armSwing.right) * 0.4} ${78 + armSwing.right} ${78 + Math.abs(armSwing.right) * 0.3}`}
        className={`${config.strokeClass} fill-none`}
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Body - rounded rectangle below head */}
      <path
        d="M 30 60 Q 30 56 34 56 L 66 56 Q 70 56 70 60 L 70 86 Q 70 90 66 90 L 34 90 Q 30 90 30 86 Z"
        className={`${config.fillClass} ${config.strokeClass}`}
        strokeWidth="2"
      />

      {/* Head breathing glow - soft radial overlay behind the head. */}
      {(glowOpacity > 0.01) && (
        <circle
          cx="50"
          cy="36"
          r={glowRadius}
          className="fill-primary"
          style={{ opacity: glowOpacity, transition: 'opacity 150ms ease-in-out' }}
        />
      )}

      {/* Head */}
      <circle
        cx="50"
        cy="36"
        r="16"
        className={`${config.fillClass} ${config.strokeClass}`}
        strokeWidth="2"
      />

      {/* Eyes - larger dots with optional highlight for expressiveness. */}
      <circle cx="44" cy="33" r="2.5" className="fill-foreground" />
      <circle cx="56" cy="33" r="2.5" className="fill-foreground" />
      {eyeHighlight > 0.05 && (
        <>
          <circle cx="45" cy="32" r="1" className="fill-white/80" />
          <circle cx="57" cy="32" r="1" className="fill-white/80" />
        </>
      )}

      {/* Mouth */}
      <path
        d={mouthPath}
        className="stroke-foreground fill-none"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
