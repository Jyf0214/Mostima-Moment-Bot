---
name: test-expansion-pattern
description: 为新模块系统性添加测试用例的模式：识别覆盖缺口、Mock 依赖、分层测试策略
source: auto-skill
extracted_at: '2026-06-20T22:56:00.000Z'
---

# 测试扩展模式

## 概述

为项目中新增或修改的模块系统性添加测试用例，确保核心逻辑有可测试性保障。

## 识别测试缺口

### 分析步骤

1. **列出新增/修改的文件**：`git diff --name-only` 或 `git log --oneline -5 --name-only`
2. **分类模块类型**：
   - 工具函数（纯函数，无副作用）
   - 数据访问层（依赖数据库/API）
   - API 端点（依赖 HTTP 请求/响应）
   - 业务逻辑层（依赖多个模块）
3. **检查现有测试**：`ls src/__tests__/` 看已有覆盖
4. **优先级排序**：核心逻辑 > 工具函数 > API 端点

### 本项目测试缺口分析结果

| 模块                                  | 类型     | 测试文件                        | 用例数 |
| ------------------------------------- | -------- | ------------------------------- | ------ |
| `src/lib/cookie.ts`                   | 工具函数 | `cookie.test.ts`                | 16     |
| `src/lib/github/auth.ts`              | 业务逻辑 | `github-auth.test.ts`           | 12     |
| `src/pages/api/webhook/github.ts`     | API 端点 | `webhook-installation.test.ts`  | 7      |
| `src/pages/api/webhook/github.ts`     | 事件集成 | `webhook-event-logging.test.ts` | 9      |
| `src/pages/api/github/private-key.ts` | API 端点 | `private-key-api.test.ts`       | 9      |
| `src/lib/ci/run-logger.ts`            | 工具函数 | `run-logger.test.ts`            | 22     |
| `src/pages/api/ci/runs.ts`            | API 端点 | `ci-runs-api.test.ts`           | 22     |

## Mock 策略

### 1. 文件系统 Mock（fs）

```typescript
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
  },
}));

const mockFs = vi.mocked(fs);

// 测试中使用
mockFs.readFileSync.mockReturnValueOnce('file-content');
mockFs.readFileSync.mockImplementationOnce(() => {
  throw new Error('ENOENT');
});
```

### 2. 数据库 Mock（Prisma）

```typescript
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    admin: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    gitHubInstallation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
```

### 3. 业务逻辑 Mock（db 函数）

```typescript
vi.mock('@/lib/db', () => ({
  getConfig: vi.fn(),
  setConfig: vi.fn(),
  getDecryptedWebhookConfig: vi.fn(),
}));

const { getConfig, setConfig, getDecryptedWebhookConfig } = await import('@/lib/db');
const mockGetConfig = vi.mocked(getConfig);
```

### 4. GitHub API Mock（fetch）

对于不需要实际调用 GitHub API 的测试，mock `generateJWT`：

```typescript
vi.mock('@/lib/github/auth', () => ({
  generateJWT: vi.fn(),
  getAppId: vi.fn(),
  getPrivateKey: vi.fn(),
}));
```

## 测试模式

### 1. 纯函数测试（cookie.ts）

```typescript
describe('Cookie 工具函数', () => {
  const originalEnv = process.env.APP_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.APP_URL;
    } else {
      process.env.APP_URL = originalEnv;
    }
  });

  it('HTTP 环境下不应该包含 Secure 标志', () => {
    process.env.APP_URL = 'http://localhost:3001';
    const result = setCookie('test', 'value');
    expect(result).not.toContain('Secure');
  });

  it('HTTPS 环境下应该包含 Secure 标志', () => {
    process.env.APP_URL = 'https://example.com';
    const result = setCookie('test', 'value');
    expect(result).toContain('Secure');
  });
});
```

### 2. 异步函数测试（getAppId/getPrivateKey）

```typescript
describe('getAppId', () => {
  afterEach(() => {
    delete process.env.GITHUB_APP_ID;
  });

  it('应该优先从环境变量读取', async () => {
    process.env.GITHUB_APP_ID = '12345';
    const result = await getAppId();
    expect(result).toBe('12345');
  });

  it('环境变量不存在时应该从 AppConfig 读取', async () => {
    delete process.env.GITHUB_APP_ID;
    mockGetConfig.mockResolvedValueOnce('67890');
    const result = await getAppId();
    expect(result).toBe('67890');
  });

  it('所有来源都没有时应该抛出错误', async () => {
    delete process.env.GITHUB_APP_ID;
    mockGetConfig.mockResolvedValueOnce(null);
    mockGetDecryptedWebhookConfig.mockResolvedValueOnce(null);
    await expect(getAppId()).rejects.toThrow('GITHUB_APP_ID not configured');
  });
});
```

### 3. Webhook 事件测试

```typescript
describe('installation 事件', () => {
  it('应该在 created 事件时创建安装记录', async () => {
    const mockAdmin = { id: 1, githubId: 12345, githubLogin: 'admin' };
    mockPrisma.admin.findFirst.mockResolvedValue(mockAdmin);
    mockPrisma.gitHubInstallation.findUnique.mockResolvedValue(null);
    mockPrisma.gitHubInstallation.create.mockResolvedValue({});

    // 模拟 webhook 处理逻辑
    const admin = await mockPrisma.admin.findFirst();
    const existing = await mockPrisma.gitHubInstallation.findUnique({
      where: { installationId: 141528128 },
    });
    expect(existing).toBeNull();

    await mockPrisma.gitHubInstallation.create({
      data: { installationId: 141528128, accountLogin: 'Jyf0214', ... },
    });

    expect(mockPrisma.gitHubInstallation.create).toHaveBeenCalled();
  });
});
```

### 4. Next.js API 端点测试（直接调用 handler）

当 `node-mocks-http` 不可用时，用手动 mock 对象替代：

```typescript
import handler from '@/pages/api/ci/runs';

function mockReqRes(
  method: string,
  opts: {
    query?: Record<string, string>;
    body?: Record<string, unknown>;
    cookies?: Record<string, string>;
  } = {}
) {
  let statusCode = 200;
  let responseData: unknown = null;

  const req = {
    method,
    query: opts.query || {},
    body: opts.body || {},
    cookies: opts.cookies || {},
    headers: {},
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify(opts.body || {}));
    },
  } as any;

  const res = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (data: unknown) => {
      responseData = data;
      return res;
    },
    _getStatusCode: () => statusCode,
    _getData: () => JSON.stringify(responseData),
  } as any;

  return { req, res };
}

describe('/api/ci/runs API', () => {
  it('应该正确查询仓库运行日志', async () => {
    mockPrisma.ciRun.findMany.mockResolvedValue([{ id: 1 }]);
    mockPrisma.ciRun.count.mockResolvedValue(1);

    const token = jwt.sign({ githubId: 12345 }, process.env.JWT_SECRET!);
    const { req, res } = mockReqRes('GET', {
      query: { repo: 'owner/repo' },
      cookies: { auth_token: token },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.runs).toEqual([{ id: 1 }]);
  });
});
```

### 5. Webhook 事件集成测试（验证日志记录调用）

验证 webhook handler 正确调用下游日志记录函数：

```typescript
const { mockRecordCiRun, mockUpdateCiRun } = vi.hoisted(() => ({
  mockRecordCiRun: vi.fn().mockResolvedValue(1),
  mockUpdateCiRun: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/ci/run-logger', () => ({
  recordCiRun: mockRecordCiRun,
  updateCiRun: mockUpdateCiRun,
}));

describe('push 事件日志', () => {
  it('应该为 push 事件创建运行日志', async () => {
    const pushPayload = {
      ref: 'refs/heads/main',
      head_commit: { id: 'abc123', message: 'feat: test' },
      pusher: { name: 'testuser' },
      repository: { full_name: 'owner/repo' },
    };

    const req = createWebhookRequest('push', pushPayload);
    const res = createMockResponse();

    await handler(req, res);

    expect(mockRecordCiRun).toHaveBeenCalledTimes(1);
    const callArgs = mockRecordCiRun.mock.calls[0][0];
    expect(callArgs.repo).toBe('owner/repo');
    expect(callArgs.event).toBe('push');
    expect(callArgs.branch).toBe('main'); // 自动去除 refs/heads/ 前缀
  });
});
```

## 测试文件命名规范

```
src/__tests__/
├── cookie.test.ts              # cookie.ts 的测试
├── github-auth.test.ts         # github/auth.ts 的测试
├── webhook-installation.test.ts # webhook installation 事件测试
├── private-key-api.test.ts     # private-key API 端点测试
├── crypto.test.ts              # crypto.ts 的测试
├── auth.test.ts                # JWT 认证测试
├── db.test.ts                  # 数据库操作测试
└── ...
```

**规则**：

- 工具函数：`<module-name>.test.ts`
- 业务逻辑：`<module-name>.test.ts`
- API 端点：`<endpoint-name>.test.ts`
- 组合测试：`<feature-name>.test.ts`

## 验证清单

添加测试后必须验证：

1. **TypeScript 类型检查**：`npx tsc --noEmit`
2. **i18n 合规性**：`npx vitest run src/__tests__/i18n.test.ts`
3. **全量测试**：`npx vitest run`
4. **测试数量确认**：输出应显示 `Tests XXX passed`

## 注意事项

- Mock 必须在 `beforeEach` 中 `vi.clearAllMocks()`
- 环境变量修改必须在 `afterEach` 中恢复
- 异步测试使用 `async/await`，不要用 `done` 回调
- 测试描述使用中文，与项目规范一致
- 新增测试文件不需要修改 `vitest.config.mts`（自动发现 `src/__tests__/**/*.test.ts`）
