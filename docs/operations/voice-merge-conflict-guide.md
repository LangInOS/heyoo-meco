# Voice Feature — Upstream Merge Conflict Guide

> 本文件列出语音输入功能对上游代码的修改点，供后续 sync 时快速定位和解决冲突。

## 改动概览

| 文件 | 改动类型 | 冲突风险 | 说明 |
|------|----------|----------|------|
| `src/renderer/features/voice/index.tsx` | **新文件** | 无 | 语音核心逻辑：adapters、hook、VoicePanel |
| `src/renderer/utils/keyboard-shortcut.ts` | **新文件** | 无 | 快捷键解析工具 |
| `src/main/ipc/voice.ts` | **新文件** | 无 | IPC handler |
| `src/main/services/voice-proxy.service.ts` | **新文件** | 无 | 本地 WebSocket 代理（handler 已提取可复用）；新增 sourceId 服务端 key 解析与 `isAllowedUpstreamTarget` 导出 |
| `src/main/http/voice-websocket.ts` | **新文件** | 无 | 独立 VoiceWebSocket，管理 `/voice/asr` 路径 |
| `src/main/http/routes/voice.routes.ts` | **新文件** | 无 | `/voice/asr/sse` HTTP 转发路由：远程客户端上传录音，服务端按 sourceId 解析真实 key 后转发 StepFun SSE 并原样回流（配套 `voice.routes.meta.ts`；`scripts/gen-api-ref.mjs` 的 ROUTE_FILES 已同步登记，新增 routes 文件时勿漏，否则 prebuild 报错） |
| `src/main/http/websocket.ts` | **未修改** | 无 | 零改动 |
| `src/main/http/server.ts` | **修改** | 低 | import + 启动调用 `initVoiceWebSocket()` + upgrade 放行 `/voice/asr` + 关闭调用 `shutdownVoiceWebSocket()` |
| `src/renderer/components/chat/InputArea.tsx` | **修改** | **高** | 4 个独立改动块（见下文） |
| `src/renderer/types/index.ts` | **修改** | 低 | 新增 `VoiceConfig` 接口 |
| `src/renderer/assets/styles/globals.css` | **修改** | 低 | 新增 `@keyframes voice-wave` |
| `src/preload/index.ts` | **修改** | 低 | `HaloAPI` 接口 + api 实现各加一行 |
| `src/main/bootstrap/extended.ts` | **修改** | 低 | 启动/清理各插一行 |

---

## 背景：远程客户端不再持有真实 apiKey（2026-09 sync）

上游把 `POST /api/config/refresh-ai-sources` 改为走 masking 控制器（安全修复，不可回退），远程客户端（Capacitor 手机端）从配置接口拿到的 `aiSources[].apiKey` 是 `'***'`。语音此前在手机端"直连 StepFun"的路径因此全部失效（桌面端走 IPC 拿真实 key，不受影响）。

修复原则：**真实 key 只在服务端出现**。两条语音路径均由服务端按 `sourceId` 从本地配置解析真实 key：

- WS 流式：`/voice/asr?...&sourceId=...`（voice-websocket.ts → voice-proxy.service.ts）
- SSE 整段转写：`POST /voice/asr/sse?target=...&sourceId=...&token=...`（voice.routes.ts）

若上游再次改动鉴权或 config 路由，需检查这两条路径是否被波及。

---

## 高冲突风险：InputArea.tsx

上游高频修改此文件。所有语音改动集中在 4 个独立代码块，各有清晰边界：

### 块 1 — hook 调用（~138–158 行）

```tsx
// 新增：从 useVoiceSTT 获取状态，创建 handleTranscript 回调
const handleTranscript = useCallback((text: string) => { ... }, [])
const { state: micState, error: micError, partialText, start: startMic, stop: stopMic, enabled: micEnabled } = useVoiceSTT(handleTranscript)
const handleMicClick = useCallback(() => {
  if (micState === 'recording') {
    void stopMic()
  } else if (micState === 'idle' || micState === 'error') {
    void startMic()
  }
  // 'transcribing' is a no-op
}, [micState, startMic, stopMic])
```

**冲突判断**：如果上游改了 `useVoiceSTT` 的调用方式或参数，需要合并。如果上游新增了其他 hook 调用，通常不影响这块。注意 `micState === 'error'` 时允许重新启动录音。

### 块 2 — displayContent（~193–197 行）

```tsx
const displayContent = isOnboardingSendStep
  ? onboardingPrompt
  : (micState === 'recording' || micState === 'transcribing') && partialText
    ? content.trimEnd() + (content ? ' ' : '') + partialText
    : content
```

**冲突判断**：如果上游改了 `content` 或 `onboardingPrompt` 的显示逻辑，可能冲突。逻辑是"录音/转写中时，把 partialText 拼到 content 后面显示"。

### 块 3 — handleSend（~489–500 行）

```tsx
if (micState === 'recording' || micState === 'transcribing') {
  const live = partialText.trim()
  if (live) { textToSend = textToSend ? `${textToSend} ${live}` : live }
  if (micState === 'recording') { void stopMic() }
}
```

**冲突判断**：如果上游改了发送逻辑（比如新增 inject 分支、图片处理），注意保留这段"折叠实时文字"的逻辑。只影响 `micState === 'recording'` 时自动停止录音。

### 块 4 — InputToolbar 麦克风按钮（~1005–1039 行）

```tsx
{!isOnboarding && micEnabled && (
  <button onClick={onMicClick} disabled={isGenerating || micState === 'transcribing'} ...>
    {micState === 'recording' ? <波形动画 /> : micState === 'transcribing' ? <转圈 /> : <Mic size={16} />}
  </button>
)}
```

**冲突判断**：如果上游重构了工具栏布局或按钮顺序，这段会被整体替换。冲突解决时保留 3 个状态（recording / transcribing / idle）的渲染逻辑即可。

---

## 低冲突风险文件

### `src/renderer/types/index.ts`

```tsx
export interface VoiceConfig {
  sourceId: string | null
  sttModel: string
  shortcutKey?: string
  shortcutMode?: 'hold' | 'toggle'
  transport?: 'websocket' | 'sse'
}
```

新增接口，与现有代码无交集。如果上游也新增了 `VoiceConfig`，合并即可。

### `src/renderer/assets/styles/globals.css`

```css
@keyframes voice-wave { ... }
```

独立 keyframes，不会与现有样式冲突。

### `src/preload/index.ts`

两处各加一行：
- `HaloAPI` 接口：`voiceGetProxyPort: () => Promise<IpcResponse<{ port: number }>>`
- `api` 对象：`voiceGetProxyPort: () => ipcRenderer.invoke('voice:get-proxy-port')`

如果上游改了 `HaloAPI` 接口定义或 `api` 对象结构，保留这两行即可。

### `src/renderer/api/transport.ts`

voice 模块 import 了 `isCapacitor()`。上游如果改了 transport 模块结构，保留 `isCapacitor` 函数即可。

### `src/main/http/voice-websocket.ts`

**新文件**，独立管理 `/voice/asr` 路径。不修改现有 `websocket.ts`。内部逻辑：
- `initVoiceWebSocket(server)` — 在传入的 HTTP server 上创建 `WebSocketServer`，path 为 `/voice/asr`
- 连接时从 query string 提取 `token`，用 `validateToken` 校验
- 校验通过后调用 `handleVoiceProxyConnection`（来自 `voice-proxy.service.ts`）
- `shutdownVoiceWebSocket()` — 关闭 voice WSS

如果上游改了 WebSocket 架构，只需确保此文件中的 `initVoiceWebSocket` 被调用即可。

### `src/main/http/websocket.ts`

**未修改**。保留原有 `initWebSocket` / `shutdownWebSocket` 在 `/ws` 路径上的 Halo IPC 逻辑。

### `src/main/http/server.ts`

四处置入：
1. import 增加 `initVoiceWebSocket`、`shutdownVoiceWebSocket`、`handleVoiceWsUpgrade`
2. 启动段：`initWebSocket(httpServer)` 后插一行 `initVoiceWebSocket()`
3. 单 upgrade handler 路由：保留原有 `/ws` 路由，新增 `/voice/asr` 独立 `if` 块路由到 `handleVoiceWsUpgrade`。Vite HMR 的 `/?` 路径也在此 handler 内放行。
4. 清理段：`cleanupServerOnError()` 新增 `shutdownVoiceWebSocket()` 调用

如果上游改了 HTTP server 启动流程或 upgrade 逻辑，保留 `/voice/asr` 独立路由块即可。注意 `noServer: true` 模式下，每个 `WebSocketServer` 各自监听 upgrade，单 handler 分发到不同 server 是为了避免 `abortHandshake` 冲突。

### `src/main/bootstrap/extended.ts`

两处各插一行：
```tsx
// 启动段
registerVoiceHandlers()
initVoiceProxy()

// 清理段
shutdownVoiceProxy()
```

如果上游改了启动/清理顺序，保持这两行在对应段落内即可。

---

## 中冲突风险：voice/index.tsx 内部逻辑

以下改动集中在 `src/renderer/features/voice/index.tsx` 内部，不涉及外部接口，但逻辑分支较密，sync 时需留意。

### StepFun 分支 — SSE 降级 + WebSocket 双路径（~672–737 行）

```tsx
} else if (source.provider === 'stepfun') {
  const isSSE = voiceConfig?.transport === 'sse' && providerMeta.sseUrl
  if (isSSE) {
    session = await startStepFunSSE(
      providerMeta.sseUrl,
      source.apiKey!,
      voiceConfig.sttModel || providerMeta.defaultSseModel!,
      { onPartial, onFinal, onError }
    )
  } else {
    let proxyUrl: string
    if (isCapacitor()) {
      const serverUrl = getRemoteServerUrl()
      if (!serverUrl) throw new Error('Server URL not configured.')
      const token = getAuthToken()
      if (!token) throw new Error('Not authenticated.')
      proxyUrl = `${serverUrl.replace(/^http/, 'ws')}/voice/asr?target=${encodeURIComponent(providerMeta.wsUrl)}&apiKey=${encodeURIComponent(source.apiKey!)}&token=${encodeURIComponent(token)}`
    } else {
      const portResp = await window.halo.voiceGetProxyPort()
      if (!portResp.success) throw new Error(portResp.error || 'Voice proxy is not available.')
      proxyUrl = `ws://127.0.0.1:${(portResp.data as { port: number }).port}/?target=${encodeURIComponent(providerMeta.wsUrl)}&apiKey=${encodeURIComponent(source.apiKey!)}`
    }
    session = await startStepFunSTT(proxyUrl, sttModel, { onPartial, onFinal, onError })
  }
}
```

**冲突判断**：如果上游改了 StepFun STT 的启动流程，注意保留 `isCapacitor()` 在 proxy URL 分支的判断。核心意图：
- `isSSE` 仅由用户选择的 `voiceConfig.transport === 'sse'` 决定，不再强制 Capacitor 走 SSE
- WebSocket 路径：Capacitor 走远程 `/voice/asr` 代理，Electron 走本地 `127.0.0.1` proxy

### `stop()` 函数 — transcribing 状态判断（~740–754 行）

```tsx
const stop = useCallback(async () => {
  if (sessionRef.current) {
    const isSSE = voiceConfig?.transport === 'sse'
    if (isSSE) { setState('transcribing') }
    await sessionRef.current.stop()
    sessionRef.current = null
    if (!isSSE) { setPartialText(''); setState('idle') }
  }
}, [voiceConfig?.transport])
```

**冲突判断**：如果上游改了 stop 流程，保留 `voiceConfig?.transport === 'sse'` 判断即可。`isCapacitor()` 不再强制 SSE。

### `cleanupServerOnError` — voice WebSocket 清理（~78–80 行）

```tsx
function cleanupServerOnError(): void {
  shutdownWebSocket()
  shutdownVoiceWebSocket()
  // ... 其余清理逻辑不变 ...
}
```

启动失败时同步清理 voice WebSocket，避免残留监听。顺序与 `stopHttpServer` 一致。

### `startStepFunSTT.cleanup` — 手动停止时 flush 积压文本（~306–322 行）

```tsx
const cleanup = async () => {
  stopped = true
  // ... 断开音频设备 ...
  if (accumulatedText) {
    callbacks.onFinal(accumulatedText)
    accumulatedText = ''
  }
  if (ws) { ws.close(1000); ws = null }
}
```

用户手动停止录音时，将 `onPartial` 积压的文本通过 `onFinal` 提交，避免 `setPartialText('')` 导致文本丢失。正常流程下 `accumulatedText` 已被服务器 `completed` 事件清空，此分支不执行。

---

## 新文件清单（上游不会冲突）

| 文件 | 职责 |
|------|------|
| `src/main/ipc/voice.ts` | 注册 `voice:get-proxy-port` IPC handler |
| `src/main/services/voice-proxy.service.ts` | 本地 WebSocket 代理（StepFun 鉴权） |
| `src/renderer/features/voice/index.tsx` | STT adapters + useVoiceSTT hook + VoicePanel |
| `src/renderer/utils/keyboard-shortcut.ts` | 快捷键解析（parse / format / matches） |
| `ios/App/App/Info.plist` | iOS 麦克风权限描述（`NSMicrophoneUsageDescription`） |
