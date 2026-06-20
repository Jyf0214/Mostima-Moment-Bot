---
name: project-security-audit
description: Multi-agent parallel project analysis with batch-organized security and quality fixes, verified by tests
source: auto-skill
extracted_at: '2026-06-20T15:00:00.000Z'
---

# Project Security Audit & Fix Workflow

## Overview

A systematic approach to analyzing a project for security, quality, and architectural issues using parallel agents, then fixing them in organized batches with test verification.

## Phase 1: Parallel Analysis (5 Agents)

Launch 5 agents simultaneously to cover all project dimensions:

### Agent 1 — Project Structure & Stack

- Full directory tree (src/, app/, lib/, prisma/, tests/, config)
- Framework/stack identification (versions, dependencies)
- API routes, pages, components inventory
- package.json scripts and dependency analysis

### Agent 2 — Database & Data Layer

- Prisma schema analysis (models, relations, indexes)
- Raw SQL / forbidden pattern search (`$executeRawUnsafe`, `$queryRaw`, `execSync prisma`)
- Prisma client instantiation points
- Database access layer patterns
- .env.example review

### Agent 3 — Auth & Security

- OAuth implementation analysis (flow, CSRF, token storage)
- Session management (cookies, JWT, expiry)
- Middleware/route protection
- Hardcoded secrets / default fallback keys
- Command injection vectors (`execSync` with user input)
- Cookie security flags (HttpOnly, Secure, SameSite)

### Agent 4 — Code Quality

- TODO/FIXME/HACK markers
- `console.log` debug leftovers
- TypeScript `any` usage, `@ts-ignore`, `@ts-expect-error`
- Error handling (empty catch blocks, swallowed errors)
- Unused imports and dead code
- Test coverage gaps
- ESLint configuration completeness

### Agent 5 — CI/CD & Deployment

- GitHub Actions workflows
- Dockerfile optimization (multi-stage, .dockerignore)
- Git hooks configuration
- Build/test/lint scripts
- Deployment strategy analysis

## Phase 2: Issue Prioritization

Categorize findings into three tiers:

### 🔴 High Priority (Fix Immediately)

- **Webhook/API endpoints blocked by auth middleware** — breaks core functionality
- **Hardcoded fallback secrets** — `process.env.X || 'default-value'` should throw, not degrade
- **Command injection** — unsanitized input in `execSync` calls
- **Missing auth on critical endpoints**

### 🟡 Medium Priority (Fix in Same Session)

- Cookie missing `Secure` flag
- Excessive `any` types (especially in security-sensitive code)
- Missing `.dockerignore`
- Weak ESLint configuration
- Unused imports

### 🟢 Low Priority (Note for Later)

- Missing structured logging
- Test coverage gaps
- i18n hardcoded strings
- Dependency misplacement (e.g., `prisma` in dependencies vs devDependencies)

## Phase 3: Batch-Organized Fixes

Group fixes by file independence to maximize parallel execution:

### Batch 1 — Core Middleware & Auth (independent files)

```
proxy.ts          — Add missing paths to publicPaths
middleware.ts     — Remove hardcoded fallback secrets
callback.ts       — Remove hardcoded fallback, add null checks
me.ts             — Remove hardcoded fallback, add null checks
```

### Batch 2 — Security Hardening (independent files)

```
login.ts          — Add Secure flag to cookies
logout.ts         — Add Secure flag to cookies
callback.ts       — Add Secure flag to cookies
workspace.ts      — Add branch name validation + git -- separator
```

### Batch 3 — TypeScript Quality (independent files)

```
runner.ts         — Remove unused imports, add typed payloads
checks.ts         — Fix catch (error: any)
webhook/github.ts — Fix payload: any types
init.ts           — Fix catch (error: any)
status.ts         — Fix catch (error: any)
github/api.ts     — Replace as any with typed interfaces
db.test.ts        — Remove dead mock code
```

### Batch 4 — Config & Pages (independent files)

```
.dockerignore     — Create new file
eslint.config.mjs — Add quality rules
dashboard.tsx     — Clear content
package.json      — Move prisma to devDependencies
```

### Batch 5 — i18n & Locale Files

```
env-error.tsx     — Replace hardcoded strings with t()
en.json           — Add missing translation keys
zh.json           — Add missing translation keys
```

## Phase 4: Verification

Run in parallel after all fixes:

```bash
# Tests (catches i18n violations, Prisma enforcement, etc.)
npx vitest run

# Type check (catches type errors from any removals)
npx tsc --noEmit
```

### Common Post-Fix Issues

1. **i18n test fails** — Server-side error messages in Chinese must be English (developer-facing, not user-facing)
2. **TypeScript strict cast errors** — `Record<string, unknown> as SomeType` may need `as unknown as SomeType`
3. **JWT_SECRET undefined** — After removing fallback, `jwt.sign()` gets `string | undefined`, needs null check first

## Key Patterns

### Hardcoded Secret Fallback — WRONG

```typescript
// ❌ Silently degrades to weak security
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
```

### Hardcoded Secret Fallback — CORRECT

```typescript
// ✅ Fails fast with clear error
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not configured');
}
const JWT_SECRET = process.env.JWT_SECRET;
```

### Command Injection — WRONG

```typescript
// ❌ Branch name injected directly into shell
execSync(`git fetch origin ${branchName}`);
```

### Command Injection — CORRECT

```typescript
// ✅ Validate + use -- separator
function validateBranchName(name: string): void {
  if (!name || /[~^:?*[\]\\]/.test(name) || name.includes('..')) {
    throw new Error(`Unsafe branch name: ${name}`);
  }
}
execSync(`git fetch origin -- ${branchName}`);
```

### Cookie Security — WRONG

```typescript
// ❌ Missing Secure flag
res.setHeader('Set-Cookie', `token=${jwt}; Path=/; HttpOnly; SameSite=Lax`);
```

### Cookie Security — CORRECT

```typescript
// ✅ All security flags present
res.setHeader('Set-Cookie', `token=${jwt}; Path=/; HttpOnly; SameSite=Lax; Secure`);
```

### Error Handling — WRONG

```typescript
// ❌ any type, no structure
} catch (error: any) {
  console.error(error.message);
}
```

### Error Handling — CORRECT

```typescript
// ✅ Typed, safe
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
}
```

## File Change Tracking

For each fix, record:

- File path
- What changed and why
- Which batch it belongs to
- Whether it was verified by tests

This ensures no file is missed and all changes are auditable.

---

## Multi-Agent Security Audit Pattern (实战经验)

### Agent 分工

| Agent   | 扫描范围                  | 重点                                 |
| ------- | ------------------------- | ------------------------------------ |
| Agent 1 | `src/pages/api/`          | 认证绕过、注入、信息泄露、CSRF       |
| Agent 2 | `src/lib/` + `src/pages/` | 数据处理、竞态条件、错误处理、加密   |
| Agent 3 | 配置文件 + 依赖           | 依赖安全、Docker、构建配置、环境变量 |

### 常见高危漏洞模式

#### 1. timingSafeEqual 长度不一致

```typescript
// ❌ 长度不同时抛出 RangeError，返回 500
return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));

// ✅ 先检查长度
if (sigBuf.length !== expectedBuf.length) return false;
return crypto.timingSafeEqual(sigBuf, expectedBuf);
```

#### 2. OAuth state 使用 Math.random()

```typescript
// ❌ 可预测，CSRF 风险
const state = Math.random().toString(36).substring(2);

// ✅ 加密安全
const state = crypto.randomUUID();
```

#### 3. Cookie Secure 标志硬编码

```typescript
// ❌ HTTP 环境下无法设置/清除 cookie
res.setHeader('Set-Cookie', 'token=; Path=/; Max-Age=0; Secure');

// ✅ 使用自适应函数
res.setHeader('Set-Cookie', clearCookie('token'));
```

#### 4. 认证绕过（条件逻辑错误）

```typescript
// ❌ token 未设置时跳过认证
if (scanToken && authHeader !== `Bearer ${scanToken}`) {
  return res.status(401).json({ error: 'Unauthorized' });
}

// ✅ token 未设置时拒绝请求
if (!scanToken) {
  return res.status(500).json({ error: 'Server configuration error' });
}
if (authHeader !== `Bearer ${scanToken}`) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

#### 5. Webhook 响应阻塞

```typescript
// ❌ 阻塞响应，GitHub 10s 超时重发
await handlePullRequest(payload);

// ✅ fire-and-forget
handlePullRequest(payload).catch((err) => {
  console.error(`Pipeline failed:`, err);
});
```

#### 6. 数据类型不匹配导致清理无效

```typescript
// ❌ githubId.toString() 匹配 triggerUser（类型不匹配）
await prisma.build.deleteMany({
  where: { triggerUser: githubId.toString() }, // "12345" ≠ "jyf0214"
});

// ✅ 使用正确的字段
await prisma.build.deleteMany({
  where: { triggerUser: githubLogin }, // "jyf0214" = "jyf0214"
});
```

### 修复优先级矩阵

| 优先级        | 类型                                 | 示例                                    |
| ------------- | ------------------------------------ | --------------------------------------- |
| 🔴 立即修复   | 认证绕过、命令注入、加密失效         | scan auth bypass、timingSafeEqual crash |
| 🟡 会话内修复 | Cookie 标志、CSRF 弱随机数、信息泄露 | logout Secure、Math.random()            |
| 🟢 后续改进   | 速率限制、安全 Headers、依赖更新     | rate limiting、CSP headers              |
