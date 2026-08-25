/**
 * 剪贴板工具：统一复制并返回真实结果
 *
 * navigator.clipboard 仅在安全上下文（HTTPS/localhost）可用，
 * HTTP 部署下会直接 reject，因此降级到 execCommand 兜底。
 */

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 降级路径：隐藏 textarea + execCommand('copy')
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
