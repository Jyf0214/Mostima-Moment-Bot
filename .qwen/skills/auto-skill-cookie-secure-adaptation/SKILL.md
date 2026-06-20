---
name: cookie-secure-adaptation
description: Next.js Cookie Secure 标志自适应：根据 APP_URL 协议动态决定 Secure 标志，避免 HTTP 环境下 cookie 被浏览器拒绝
source: auto-skill
extracted_at: '2026-06-20T13:28:34.287Z'
---

# Cookie Secure 标志自适应模式

## 问题

Next.js 应用同时运行在 HTTP（本地开发）和 HTTPS（生产环境）时，Cookie 的 `Secure` 标志行为不同：

- **HTTPS 环境**：必须设置 `Secure`，否则现代浏览器会拒绝
- **HTTP 环境**：不能设置 `Secure`，否则浏览器拒绝存储和发送 cookie

硬编码 `Secure` 标志会导致其中一种环境失败。

## 解决方案

提取工具函数 `src/lib/cookie.ts`，根据 `APP_URL` 环境变量自动判断协议：

```typescript
function isSecureProtocol(): boolean {
  return process.env.APP_URL?.startsWith('https') ?? false;
}

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
  if (httpOnly) parts.push('HttpOnly');
  if (isSecureProtocol()) parts.push('Secure');
  return parts.join('; ');
}

export function clearCookie(name: string, options: { path?: string } = {}): string {
  return setCookie(name, '', { ...options, maxAge: 0 });
}
```

## 使用方式

### 设置 Cookie

```typescript
// 修复前（硬编码 Secure）
res.setHeader(
  'Set-Cookie',
  `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600; Secure`
);

// 修复后（自适应）
import { setCookie } from '@/lib/cookie';
res.setHeader('Set-Cookie', setCookie('oauth_state', state));
```

### 清除 Cookie

```typescript
// 修复前
res.setHeader('Set-Cookie', 'oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure');

// 修复后
import { clearCookie } from '@/lib/cookie';
res.setHeader('Set-Cookie', clearCookie('oauth_state'));
```

### 自定义 Path

```typescript
res.setHeader('Set-Cookie', setCookie('github_install_state', state, { path: '/api/github' }));
res.setHeader('Set-Cookie', clearCookie('github_install_state', { path: '/api/github' }));
```

## 受影响的文件（典型）

| 文件                               | Cookie 名                    | 说明                  |
| ---------------------------------- | ---------------------------- | --------------------- |
| `src/pages/api/auth/login.ts`      | `oauth_state`                | OAuth 登录 state      |
| `src/pages/api/auth/callback.ts`   | `oauth_state` + `auth_token` | 清除 state + 设置 JWT |
| `src/pages/api/github/install.ts`  | `github_install_state`       | 安装 state            |
| `src/pages/api/github/callback.ts` | `github_install_state`       | 清除安装 state        |

## 环境变量要求

```
# 本地开发
APP_URL=http://localhost:3001

# 生产环境
APP_URL=https://manticore-bot.example.com
```

`APP_URL` 未设置时默认为 HTTP（不添加 `Secure`），这是一种安全的降级行为。

## 注意事项

- 所有 cookie 设置必须统一使用 `setCookie()` / `clearCookie()`，禁止硬编码
- `SameSite=Lax` 是默认值，适用于大多数场景（OAuth 回调、安装回调）
- 需要跨站 cookie 的场景（如嵌入 iframe）才需要 `SameSite=None`，此时必须同时设置 `Secure`
- `Max-APE` 默认 600 秒（10 分钟），JWT token 等长生命周期 cookie 需要显式设置更大的值
