/**
 * Keyboard shortcut parsing, formatting, and matching.
 *
 * Format: "Modifier+Modifier+Key", e.g. "Ctrl+Alt+V", "Fn", "Super+Alt+V".
 * Supported modifiers: Ctrl, Alt, Shift, Cmd (macOS meta), Super (Win/Linux meta).
 * Cmd and Super are aliases - both map to KeyboardEvent.metaKey.
 */

export interface ParsedShortcut {
  key: string        // The non-modifier key, e.g. "V", "Space", "Fn"
  ctrl: boolean
  alt: boolean
  meta: boolean      // Cmd on macOS, Super/Win on Windows/Linux
  shift: boolean
}

const MODIFIER_NAMES = ['Ctrl', 'Alt', 'Shift', 'Cmd', 'Super', 'Win', 'Meta'] as const

const META_ALIASES = new Set(['Cmd', 'Super', 'Win', 'Meta'])

/**
 * True if the key name is a modifier (Ctrl, Alt, Shift, Cmd, Super, Win, Meta).
 */
export function isModifierKey(key: string): boolean {
  return (MODIFIER_NAMES as readonly string[]).includes(key)
}

/**
 * Parse a shortcut string like "Ctrl+Alt+V" into structured parts.
 */
export function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.split('+').map(p => p.trim()).filter(Boolean)
  const result: ParsedShortcut = {
    key: '',
    ctrl: false,
    alt: false,
    meta: false,
    shift: false,
  }
  for (const part of parts) {
    if (part === 'Ctrl') result.ctrl = true
    else if (part === 'Alt') result.alt = true
    else if (part === 'Shift') result.shift = true
    else if (META_ALIASES.has(part)) result.meta = true
    else result.key = part
  }
  return result
}

/**
 * Format a KeyboardEvent into a shortcut string like "Ctrl+Alt+V".
 * Returns empty string if only modifier keys are pressed (incomplete).
 */
export function formatShortcut(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) {
    // Use the platform-native name for readability.
    parts.push(typeof window !== 'undefined' && window.platform?.isMac ? 'Cmd' : 'Super')
  }

  const key = e.key
  // Skip pure modifier presses - the user is still building the combination.
  if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') {
    return ''
  }

  // Normalize special keys to readable names.
  let keyName = key
  if (key === ' ') keyName = 'Space'
  else if (key === 'ArrowUp') keyName = 'Up'
  else if (key === 'ArrowDown') keyName = 'Down'
  else if (key === 'ArrowLeft') keyName = 'Left'
  else if (key === 'ArrowRight') keyName = 'Right'
  // Single-letter keys: uppercase for display consistency.
  else if (key.length === 1) keyName = key.toUpperCase()

  parts.push(keyName)
  return parts.join('+')
}

/**
 * Check if a KeyboardEvent matches a shortcut string.
 */
export function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  if (!shortcut) return false
  const parsed = parseShortcut(shortcut)
  if (!parsed.key) return false

  const keyMatch = e.key.toLowerCase() === parsed.key.toLowerCase() ||
    (parsed.key === 'Space' && e.key === ' ') ||
    (parsed.key === 'Up' && e.key === 'ArrowUp') ||
    (parsed.key === 'Down' && e.key === 'ArrowDown') ||
    (parsed.key === 'Left' && e.key === 'ArrowLeft') ||
    (parsed.key === 'Right' && e.key === 'ArrowRight')

  return (
    keyMatch &&
    e.ctrlKey === parsed.ctrl &&
    e.altKey === parsed.alt &&
    e.metaKey === parsed.meta &&
    e.shiftKey === parsed.shift
  )
}

/**
 * Human-readable description for display, e.g. "⌘+V" on macOS, "Ctrl+Alt+V" elsewhere.
 * Keeps the raw string when symbols aren't applicable.
 */
export function describeShortcut(shortcut: string): string {
  if (!shortcut) return ''
  const isMac = typeof window !== 'undefined' && window.platform?.isMac
  if (!isMac) return shortcut

  const parts = shortcut.split('+').map(p => p.trim())
  return parts
    .map(p => {
      switch (p) {
        case 'Cmd': return '⌘'
        case 'Ctrl': return '⌃'
        case 'Alt': return '⌥'
        case 'Shift': return '⇧'
        default: return p
      }
    })
    .join('+')
}
