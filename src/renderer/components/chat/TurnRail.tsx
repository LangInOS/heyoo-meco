/**
 * TurnRail — Conversation-turn navigation rail.
 *
 * Desktop (>=640px): a magnetic tick rail flush against the right edge of the
 * chat scroll area. Each user question is a short tick. Moving the mouse over
 * the rail magnetically enlarges + brightens the nearest tick (±2 neighbors
 * decay by offset) and shows a truncated preview to its left. Clicking a tick
 * navigates back to that question.
 *
 * Mobile (<640px): long-press the right edge summons a narrow magnetic rail
 * overlay (visually like the desktop tick column, but with a wider touch
 * band). While held, sliding the finger up/down magnetically highlights the
 * nearest tick (±2 neighbors decay) and shows a preview bubble. Lifting the
 * finger navigates to the highlighted turn and dismisses the overlay.
 *
 * Shared design:
 *  - Ticks/items ordered top→bottom = oldest→newest (matches reading order).
 *  - >=1 user turn renders the rail; 0 turns → nothing.
 *  - All colors use theme tokens (muted-foreground, primary, popover, border).
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { cn } from '../../lib/utils'

export interface TurnItem {
  /** Message id — used to locate the DOM node for scroll navigation. */
  id: string
  /** The user's question text, shown truncated in the hover preview. */
  content: string
}

interface TurnRailProps {
  /** User-question turns, oldest first (top→bottom). */
  turns: TurnItem[]
  /** Called with the clicked turn's message id — parent scrolls to it. */
  onNavigate: (messageId: string) => void
  /** ID of the turn currently visible in the chat scroll area (scroll-spy). */
  activeTurnId?: string | null
}

/** Minimum number of turns required for the rail to render.
 *  Even a single user question gets a tick so it can be navigated back to. */
const MIN_TURNS = 1

/**
 * Width (px) for a tick based on its signed offset from the highlighted tick.
 *   offset 0  (the closest)  → 40px (longest)
 *   offset ±1                  → 32px
 *   offset ±2                  → 24px
 *   |offset| > 2 (outside the window) → 16px (resting, no effect)
 */
function widthForOffset(offset: number): number {
  const abs = Math.abs(offset)
  if (abs === 0) return 40
  if (abs === 1) return 32
  if (abs === 2) return 24
  return 16
}

/** True when a tick is within the ±2 window around the highlighted tick. */
function inWindow(offset: number): boolean {
  return Math.abs(offset) <= 2
}

/** Renders a preview tooltip at the body level to avoid overflow clipping.
 *  Uses useLayoutEffect + rAF to avoid forced reflow during tick transitions. */
function PreviewPortal({
  tickEl,
  content,
}: {
  tickEl: HTMLElement | null
  content: string
}) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  useLayoutEffect(() => {
    if (!tickEl) { setPos(null); return }
    const frame = requestAnimationFrame(() => {
      const rect = tickEl.getBoundingClientRect()
      const rawTop = rect.top + rect.height / 2
      // Clamp so tooltip stays within viewport (est. ~40px half-height)
      const top = Math.max(40, Math.min(window.innerHeight - 40, rawTop))
      setPos({ top, right: window.innerWidth - rect.left + 8 })
    })
    return () => cancelAnimationFrame(frame)
  }, [tickEl])

  if (!tickEl || !pos) return null
  return createPortal(
    <div
      className="fixed z-[9999] w-[200px] px-2 py-1
        bg-popover text-popover-foreground
        border border-border rounded-lg
        text-xs leading-relaxed shadow-md
        line-clamp-2 break-words
        animate-fade-in pointer-events-none"
      style={{ top: pos.top, right: pos.right, transform: 'translateY(-50%)' }}
    >
      {content}
    </div>,
    document.body,
  )
}

// ============================================================
// Mobile — floating prev/next turn nav buttons (left side)
// ============================================================

function TurnNavButtons({ turns, activeTurnId, onNavigate }: TurnRailProps) {
  // Find active index, default to 0 if no active turn is found
  const activeIndex = activeTurnId 
    ? turns.findIndex(t => t.id === activeTurnId) 
    : 0
  // Clamp to valid range
  const clampedIndex = Math.max(0, Math.min(turns.length - 1, activeIndex))
  
  const isFirst = clampedIndex === 0
  const isLast = clampedIndex === turns.length - 1

  // Only show when there are at least 2 turns to navigate between
  if (turns.length < 2) return null

  const handlePrev = () => {
    if (clampedIndex > 0) {
      haptic(10)
      onNavigate(turns[clampedIndex - 1].id)
    }
  }

  const handleNext = () => {
    if (clampedIndex < turns.length - 1) {
      haptic(10)
      onNavigate(turns[clampedIndex + 1].id)
    }
  }

  return (
    <div className="absolute bottom-3 left-3 z-[60] flex flex-col gap-1.5 select-none">
      <button
        onClick={handlePrev}
        disabled={isFirst}
        className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center',
          'bg-background/60 backdrop-blur-sm border border-border/20',
          'shadow-sm transition-all duration-150',
          isFirst
            ? 'opacity-25 pointer-events-none'
            : 'active:scale-90 active:bg-background/80',
        )}
        aria-label="Previous question"
      >
        <ChevronUp className="w-4 h-4 text-muted-foreground" />
      </button>
      <button
        onClick={handleNext}
        disabled={isLast}
        className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center',
          'bg-background/60 backdrop-blur-sm border border-border/20',
          'shadow-sm transition-all duration-150',
          isLast
            ? 'opacity-25 pointer-events-none'
            : 'active:scale-90 active:bg-background/80',
        )}
        aria-label="Next question"
      >
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  )
}

export function TurnRail({ turns, onNavigate, activeTurnId }: TurnRailProps) {
  const isMobile = useIsMobile()

  // ── Scroll-spy: detect which user-turn message is currently in view ──
  // Uses IntersectionObserver on the scroll container + MutationObserver to
  // handle Virtuoso's virtualized rendering (elements appear/disappear).
  const [visibleTurnId, setVisibleTurnId] = useState<string | null>(null)

  useEffect(() => {
    const turnIdSet = new Set(turns.map(t => t.id))
    const visibleMap = new Map<string, number>()
    const observed = new Set<Element>()

    // Locate Virtuoso's scroll container (closest ancestor with overflow-y: auto)
    let scrollEl: HTMLElement | null = null
    const railEl = document.querySelector('[data-turn-rail]')
    if (railEl) {
      let node: HTMLElement | null = railEl.parentElement
      while (node) {
        const cs = getComputedStyle(node)
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') {
          scrollEl = node
          break
        }
        node = node.parentElement
      }
    }

    const pickBest = () => {
      let best: string | null = null
      let bestRatio = 0
      for (const [id, ratio] of visibleMap) {
        if (ratio > bestRatio) { bestRatio = ratio; best = id }
      }
      setVisibleTurnId(best)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute('data-message-id')
          if (!id || !turnIdSet.has(id)) continue
          if (entry.isIntersecting) {
            visibleMap.set(id, entry.intersectionRatio)
          } else {
            visibleMap.delete(id)
          }
        }
        pickBest()
      },
      {
        root: scrollEl,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    )

    const tryObserve = (el: Element) => {
      if (observed.has(el)) return
      observed.add(el)
      observer.observe(el)
    }

    // Observe any existing turn elements
    for (const turn of turns) {
      const el = document.querySelector(`[data-message-id="${turn.id}"]`)
      if (el) tryObserve(el)
    }

    // MutationObserver: catch elements added/removed by Virtuoso virtualization
    const mutationObs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.hasAttribute('data-message-id') && turnIdSet.has(node.getAttribute('data-message-id')!)) {
              tryObserve(node)
            }
            // Also check children (Virtuoso may wrap items)
            for (const child of node.querySelectorAll('[data-message-id]')) {
              const id = child.getAttribute('data-message-id')
              if (id && turnIdSet.has(id)) tryObserve(child)
            }
          }
        }
        for (const node of m.removedNodes) {
          if (node instanceof HTMLElement && observed.has(node)) {
            observer.unobserve(node)
            observed.delete(node)
          }
        }
      }
    })

    const watchRoot = scrollEl ?? document.body
    mutationObs.observe(watchRoot, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mutationObs.disconnect()
    }
  }, [turns])

  const currentTurnId = activeTurnId ?? visibleTurnId

  if (turns.length < MIN_TURNS) return null

  if (isMobile) {
    return (
      <>
        <TurnRailMobile turns={turns} onNavigate={onNavigate} activeTurnId={currentTurnId} />
        <TurnNavButtons turns={turns} onNavigate={onNavigate} activeTurnId={currentTurnId} />
      </>
    )
  }
  return <TurnRailDesktop turns={turns} onNavigate={onNavigate} activeTurnId={currentTurnId} />
}

// ============================================================
// Desktop — magnetic tick rail
// ============================================================

function TurnRailDesktop({ turns, onNavigate, activeTurnId }: TurnRailProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const activeIndex = activeTurnId ? turns.findIndex(t => t.id === activeTurnId) : -1

  const containerRef = useRef<HTMLDivElement>(null)
  const tickRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Dynamically shrink gap when ticks would overflow the container
  const [dynamicGap, setDynamicGap] = useState(8)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const TICK_H = 4 // h-1 = 4px
    const ro = new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height
      if (turns.length <= 1) { setDynamicGap(8); return }
      const maxGap = Math.floor((h - turns.length * TICK_H) / (turns.length - 1))
      setDynamicGap(Math.max(2, Math.min(8, maxGap)))
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [turns.length])

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null)
  }, [])

  // Find the tick whose vertical center is closest to the cursor and mark it.
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (turns.length === 0) return
    const cursorY = e.clientY
    let minDist = Infinity
    let nearest = 0
    for (let i = 0; i < turns.length; i++) {
      const el = tickRefs.current[i]
      if (!el) continue
      const rect = el.getBoundingClientRect()
      const center = rect.top + rect.height / 2
      const dist = Math.abs(center - cursorY)
      if (dist < minDist) {
        minDist = dist
        nearest = i
      }
    }
    setHoverIndex(nearest)
  }, [turns.length])

  return (
    <div
      ref={containerRef}
      className="absolute right-0 top-0 bottom-0 w-8 z-20 flex flex-col justify-center items-end pr-1"
      data-turn-rail
      style={{ gap: `${dynamicGap}px` }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      aria-label="Conversation turns navigation"
    >
      {turns.map((turn, i) => {
        const isHovered = hoverIndex === i
        // Scroll-spy: color-only highlight, no width growth, no preview
        const isActiveVisible = hoverIndex == null && activeIndex === i
        const offset = hoverIndex == null ? Infinity : i - hoverIndex
        const active = inWindow(offset)
        const restingWidth = 16
        const width = active ? widthForOffset(offset) : restingWidth
        return (
          <div key={turn.id} className="relative flex items-center justify-end">
            {isHovered && (
              <PreviewPortal tickEl={tickRefs.current[i]} content={turn.content} />
            )}
            <button
              ref={(el) => { tickRefs.current[i] = el }}
              type="button"
              onClick={() => onNavigate(turn.id)}
              data-turn-id={turn.id}
              aria-label={`Go to question ${i + 1}`}
              className={cn(
                'h-1 rounded-full transition-all duration-150 cursor-pointer',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                isHovered || isActiveVisible
                  ? 'bg-primary opacity-100'
                  : active
                    ? 'bg-muted-foreground/55'
                    : 'bg-muted-foreground/25 hover:bg-muted-foreground/40',
              )}
              style={{ width: `${width}px` }}
            />
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// Mobile — swipe-up flick summons a persistent magnetic rail;
//          scrub with finger to preview, lift to navigate;
//          swipe-down flick dismisses.
// ============================================================

/** Minimum vertical travel (px) at which a fast flick is recognized. */
const FLICK_MIN_DIST = 50
/** Max gesture duration (ms) to still count as a flick. */
const FLICK_MAX_MS = 400
/** Required vertical / horizontal ratio to treat a flick as vertical. */
const FLICK_VH_RATIO = 1.5
/** Width (px) of the mobile rail band — wider than desktop for touch. */
const MOBILE_BAND_W = 36

/** Safe haptic feedback — silently ignored on unsupported platforms (e.g. desktop). */
function haptic(ms: number) {
  try { navigator.vibrate?.(ms) } catch { /* noop */ }
}

/** Auto-dismiss delay after last interaction (ms). */
const AUTO_DISMISS_MS = 3000

function TurnRailMobile({ turns, onNavigate, activeTurnId }: TurnRailProps) {
  const [open, setOpen] = useState(false)

  // When the rail is open and the user is scrubbing it, we set this so the
  // global flick detector doesn't misread the scrub as a dismiss-down flick.
  const scrubbingRef = useRef(false)

  // ── Auto-dismiss timer ──
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
  }, [])
  const resetTimer = useCallback(() => {
    clearTimer()
    dismissTimerRef.current = setTimeout(() => setOpen(false), AUTO_DISMISS_MS)
  }, [clearTimer])

  // ── Global vertical-flick detector (window-level, passive) ──
  useEffect(() => {
    let startX = 0, startY = 0, startT = 0

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      startX = t.clientX; startY = t.clientY; startT = Date.now()
    }

    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      const dt = Date.now() - startT
      if (dt > FLICK_MAX_MS) return
      if (Math.abs(dx) * FLICK_VH_RATIO > Math.abs(dy)) return
      const dist = Math.abs(dy)
      if (dist < FLICK_MIN_DIST) return

      if (!scrubbingRef.current) {
        setOpen(true)
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Clean up timer on unmount
  useEffect(() => clearTimer, [clearTimer])

  if (!open) return null

  return (
    <TurnRailMobileRail
      turns={turns}
      onNavigate={onNavigate}
      activeTurnId={activeTurnId}
      onScrubChange={(scrubbing) => { scrubbingRef.current = scrubbing }}
      resetDismissTimer={resetTimer}
    />
  )
}

function TurnRailMobileRail({
  turns,
  onNavigate,
  activeTurnId,
  onScrubChange,
  resetDismissTimer,
}: {
  turns: TurnItem[]
  onNavigate: (id: string) => void
  activeTurnId?: string | null
  onScrubChange: (scrubbing: boolean) => void
  resetDismissTimer: () => void
}) {
  // Index of the turn currently under the finger (null when not touching).
  const [touchIndex, setTouchIndex] = useState<number | null>(null)
  // Scroll mode: user long-pressed to enter rail-content-scrolling mode
  const [scrollMode, setScrollMode] = useState(false)
  const activeIndex = activeTurnId ? turns.findIndex(t => t.id === activeTurnId) : -1

  // Track last scrubbed tick for haptic on change
  const lastTickRef = useRef<number | null>(null)
  const touchingRef = useRef(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollExitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tickRefs = useRef<(HTMLDivElement | null)[]>([])
  const mobileContainerRef = useRef<HTMLDivElement>(null)

  const nearestIndex = useCallback((clientY: number) => {
    let minDist = Infinity
    let nearest = 0
    for (let i = 0; i < turns.length; i++) {
      const el = tickRefs.current[i]
      if (!el) continue
      const rect = el.getBoundingClientRect()
      const center = rect.top + rect.height / 2
      const dist = Math.abs(center - clientY)
      if (dist < minDist) {
        minDist = dist
        nearest = i
      }
    }
    return nearest
  }, [turns.length])

  // Start auto-dismiss on mount, reset on every interaction.
  useEffect(() => { resetDismissTimer() }, [resetDismissTimer])

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    if (scrollExitTimer.current) clearTimeout(scrollExitTimer.current)
  }, [])

  // Auto-scroll rail to keep active tick visible when chat scrolls
  useEffect(() => {
    if (touchingRef.current || activeIndex < 0) return
    const el = tickRefs.current[activeIndex]
    const container = mobileContainerRef.current
    if (el && container) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activeIndex])

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  // Touch handlers: two-mode interaction (scrub vs scroll)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchingRef.current = true
    resetDismissTimer()
    if (scrollExitTimer.current) {
      clearTimeout(scrollExitTimer.current)
      scrollExitTimer.current = null
    }

    if (scrollMode) {
      // Scroll mode: let browser handle scrolling natively
      return
    }

    // Scrub mode: magnetic tick selection
    onScrubChange(true)
    const y = e.touches[0].clientY
    const idx = nearestIndex(y)
    setTouchIndex(idx)
    lastTickRef.current = idx
    haptic(8)

    // Start long-press timer to switch to scroll mode
    clearLongPress()
    longPressTimer.current = setTimeout(() => {
      setScrollMode(true)
      setTouchIndex(null)
      onScrubChange(false)
      haptic(15)
    }, 500)
  }, [scrollMode, nearestIndex, onScrubChange, resetDismissTimer, clearLongPress])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    resetDismissTimer()
    if (scrollMode) {
      // Scroll mode: native scrolling, no prevention
      return
    }
    // Scrub mode: prevent browser scroll, do magnetic selection
    e.preventDefault()
    clearLongPress() // Moved → cancel long-press
    const y = e.touches[0].clientY
    const idx = nearestIndex(y)
    if (idx !== lastTickRef.current) {
      lastTickRef.current = idx
      haptic(5)
    }
    setTouchIndex(idx)
  }, [scrollMode, nearestIndex, resetDismissTimer, clearLongPress])

  const handleTouchEnd = useCallback(() => {
    touchingRef.current = false
    clearLongPress()

    if (scrollMode) {
      // Scroll mode: stay in scroll mode, schedule exit after inactivity
      scrollExitTimer.current = setTimeout(() => {
        setScrollMode(false)
      }, 3000)
      resetDismissTimer()
      return
    }

    // Scrub mode: navigate to selected tick
    onScrubChange(false)
    if (touchIndex != null) {
      haptic(20)
      onNavigate(turns[touchIndex].id)
    }
    setTouchIndex(null)
    lastTickRef.current = null
    resetDismissTimer()
  }, [scrollMode, touchIndex, onNavigate, onScrubChange, turns, resetDismissTimer, clearLongPress])

  return (
    /* Narrow magnetic rail confined to the chat area. Auto-dismisses
       after AUTO_DISMISS_MS of inactivity. */
    <div
      ref={mobileContainerRef}
      className="absolute right-0 top-0 bottom-0 z-[70] flex flex-col justify-start items-end gap-1 pr-1 overflow-y-auto scrollbar-none touch-none select-none"
      data-turn-rail
      style={{ width: `${MOBILE_BAND_W}px`, WebkitTouchCallout: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => { onScrubChange(false); setTouchIndex(null) }}
    >
      <div className="flex-1 min-h-0" />
      {turns.map((turn, i) => {
          const isTouched = touchIndex === i
          const isActiveVisible = touchIndex == null && activeIndex === i
          const offset = touchIndex == null ? Infinity : i - touchIndex
          const active = inWindow(offset)
          const restingWidth = 16
          const width = active ? widthForOffset(offset) : restingWidth
          return (
            <div key={turn.id} className="relative flex items-center justify-end">
              {isTouched && (
                <PreviewPortal tickEl={tickRefs.current[i]} content={turn.content} />
              )}
              {/* Tick — wider touch target wrapper + visible bar */}
              <div
                ref={(el) => { tickRefs.current[i] = el }}
                className="flex items-center justify-end"
                style={{ minWidth: '32px', minHeight: '24px' }}
              >
                <div
                  className={cn(
                    'h-1 rounded-full transition-all duration-150',
                    isTouched || isActiveVisible
                      ? 'bg-primary opacity-100'
                      : active
                        ? 'bg-muted-foreground/55'
                        : 'bg-muted-foreground/30',
                  )}
                  style={{ width: `${width}px` }}
                />
              </div>
            </div>
          )
        })}
      <div className="flex-1 min-h-0" />
    </div>
  )
}
