/**
 * 统一 API 请求封装
 *
 * - 自动解析 JSON 响应
 * - 超时与网络错误统一抛出 ApiError（status=0）
 * - 非 2xx 抛出携带服务端 error 字段的 ApiError，避免调用方各自处理
 */

/** API 错误：status 为 HTTP 状态码，0 表示网络错误或超时 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const DEFAULT_TIMEOUT_MS = 20000;

export interface ApiJsonOptions extends RequestInit {
  /** 超时毫秒数，默认 20000 */
  timeoutMs?: number;
}

/**
 * 发起 JSON 请求并解析响应
 *
 * @throws {ApiError} 非 2xx（message 优先取服务端 error 字段）、网络错误或超时
 */
export async function apiJson<T = unknown>(url: string, options: ApiJsonOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options;
  const controller = new AbortController();
  // 超时预算覆盖到响应体读取完毕：此前 timer 在响应头到达后即清除，
  // 挂起的响应体会让请求永久悬挂、按钮永远转圈
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: controller.signal });
    let text = '';
    try {
      text = await res.text();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ApiError(0, `timeout after ${timeoutMs}ms while reading response body`);
      }
      throw new ApiError(0, err instanceof Error ? err.message : String(err));
    }

    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
        // 非 JSON 响应体：失败时把片段带进错误信息，避免只看到笼统的 HTTP xxx
        if (!res.ok) {
          throw new ApiError(res.status, text.slice(0, 300) || `HTTP ${res.status}`);
        }
      }
    }

    if (!res.ok) {
      const serverMessage =
        data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
          ? (data as { error: string }).error
          : '';
      throw new ApiError(res.status, serverMessage || `HTTP ${res.status}`);
    }

    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, `timeout after ${timeoutMs}ms`);
    }
    throw new ApiError(0, err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 从捕获的错误中提取可展示的消息：
 * 服务端返回的 error 原样展示，网络错误/超时回退到调用方提供的本地化文案
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status !== 0 && err.message) return err.message;
  return fallback;
}

/** 判断是否为登录态失效（401） */
export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

/** 登录态失效（或其他需要清除全部客户端状态的场景）时整页跳回首页 */
export function redirectToHome(): void {
  window.location.href = '/';
}
