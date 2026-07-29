/**
 * TTS 文本预处理 — 剥离 markdown 语法，提取可朗读的纯文本
 *
 * 设计原则：
 * - 保留语义内容，去除符号噪音（#、*、`、[]() 等）
 * - 代码块整体跳过（朗读代码无意义且冗长）
 * - 图片/链接保留 alt 文本或链接文本
 * - 表格转为行式描述
 * - 保持段落分隔，避免不同段落粘连
 */

/**
 * 从 markdown 文本中提取适合语音朗读的纯文本
 * - 移除代码块（```...``` 和缩进代码块）
 * - 移除行内代码反引号
 * - 移除标题井号、列表符号、引用符号
 * - 保留链接文本、图片 alt
 * - 保留段落结构
 */
export function stripMarkdownForTTS(markdown: string): string {
  if (!markdown) return ''

  const lines = markdown.split('\n')
  const result: string[] = []
  let inCodeBlock = false
  let codeBlockFence = ''

  for (const line of lines) {
    // 代码块围栏检测
    const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/)
    if (fenceMatch) {
      const fence = fenceMatch[2][0] // ` 或 ~
      const fenceLen = fenceMatch[2].length
      if (!inCodeBlock) {
        inCodeBlock = true
        codeBlockFence = fence.repeat(fenceLen)
        continue
      } else if (line.trimStart().startsWith(codeBlockFence)) {
        inCodeBlock = false
        codeBlockFence = ''
        continue
      }
    }
    if (inCodeBlock) continue // 跳过代码块内容

    // 跳过 HTML 注释
    if (/^\s*<!--/.test(line)) continue

    let processed = line

    // 移除标题井号（保留标题文本）
    processed = processed.replace(/^#{1,6}\s+/, '')
    // 移除引用符号
    processed = processed.replace(/^\s*>\s?/, '')
    // 移除列表符号（- * + 数字.）
    processed = processed.replace(/^\s*[-*+]\s+/, '')
    processed = processed.replace(/^\s*\d+\.\s+/, '')
    // 移除任务列表标记
    processed = processed.replace(/^\s*\[[ xX]\]\s*/i, '')
    // 移除水平分割线
    if (/^\s*([-*_])\1{2,}\s*$/.test(processed)) continue

    // 行内处理
    // 行内代码：`code` → code
    processed = processed.replace(/`([^`]+)`/g, '$1')
    // 图片：![alt](url) → alt
    processed = processed.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // 链接：[text](url) → text
    processed = processed.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 粗体/斜体：**text** / *text* / __text__ / _text_ → text
    processed = processed.replace(/\*\*([^*]+)\*\*/g, '$1')
    processed = processed.replace(/__([^_]+)__/g, '$1')
    processed = processed.replace(/\*([^*]+)\*/g, '$1')
    processed = processed.replace(/_([^_]+)_/g, '$1')
    // 删除引用标记 [^1]
    processed = processed.replace(/\[\^[^\]]+\]/g, '')

    result.push(processed)
  }

  // 合并并清理多余空行
  return result
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')  // 多个空行压成一个
    .trim()
}
