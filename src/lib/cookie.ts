/**
 * Cookie 工具函数
 * 根据 APP_URL 协议自动决定是否添加 Secure 标志
 * HTTP 环境下 Secure 标志会导致浏览器拒绝存储 cookie
 */

function isSecureProtocol(): boolean {
  return process.env.APP_URL?.startsWith('https') ?? false;
}

/**
 * 生成 Set-Cookie 字符串
 * @param name - cookie 名称
 * @param value - cookie 值
 * @param options - 可选配置
 */
export function setCookie(
  name: string,
  value: string,
  options: {
    path?: string;
    maxAge?: number;
    httpOnly?: boolean;
    sameSite?: 'Lax' | 'Strict' | 'None';
  } = {}
): string {
  const { path = '/', maxAge = 600, httpOnly = true, sameSite = 'Lax' } = options;

  const parts = [`${name}=${value}`, `Path=${path}`, `Max-Age=${maxAge}`, `SameSite=${sameSite}`];

  if (httpOnly) {
    parts.push('HttpOnly');
  }

  if (isSecureProtocol()) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

/**
 * 生成清除 cookie 的 Set-Cookie 字符串
 */
export function clearCookie(
  name: string,
  options: {
    path?: string;
  } = {}
): string {
  return setCookie(name, '', { ...options, maxAge: 0 });
}
