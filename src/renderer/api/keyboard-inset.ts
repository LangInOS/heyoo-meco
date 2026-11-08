/**
 * Capacitor Mobile Shell — Keyboard Inset
 *
 * On iOS the layout viewport stays full-height while the keyboard shows, and
 * the Keyboard plugin's `body` resize only sets an inline body height — it
 * cannot move the position: fixed `#root`, so the composer stays behind the
 * keyboard. The native `keyboardWillShow` / `keyboardDidHide` events carry the
 * exact keyboard height; writing it as the `--keyboard-inset-bottom` variable
 * lets `globals.css` lift `#root` above the keyboard.
 *
 * iOS only: on Android the WebView itself resizes with the keyboard, so the
 * variable must stay unset.
 *
 * No-ops in Electron/Web: Capacitor checks short-circuit before any work.
 */

import { isCapacitor } from './transport'

const KEYBOARD_INSET = '--keyboard-inset-bottom'

/**
 * One-time keyboard inset init. Safe to call before React mounts.
 */
export async function initKeyboardInset(): Promise<void> {
  if (!isCapacitor()) return

  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.getPlatform() !== 'ios') return
    const { Keyboard } = await import('@capacitor/keyboard')

    Keyboard.addListener('keyboardWillShow', (info) => {
      document.documentElement.style.setProperty(KEYBOARD_INSET, `${Math.round(info.keyboardHeight)}px`)
    })
    Keyboard.addListener('keyboardDidHide', () => {
      document.documentElement.style.removeProperty(KEYBOARD_INSET)
    })
  } catch (err) {
    console.warn('[KeyboardInset] @capacitor/keyboard unavailable, keyboard inset disabled:', err)
  }
}
