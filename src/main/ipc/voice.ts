/**
 * IPC handlers for voice feature.
 */

import { ipcMain } from 'electron'
import { getProxyPort } from '../services/voice-proxy.service'

export function registerVoiceHandlers(): void {
  ipcMain.handle('voice:get-proxy-port', async () => {
    const port = getProxyPort()
    if (port === null) {
      return {
        success: false,
        error: 'Voice proxy is not available. Please restart the app.',
      }
    }
    return { success: true, data: { port } }
  })
}
