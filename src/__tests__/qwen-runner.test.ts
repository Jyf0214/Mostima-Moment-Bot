import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SpawnResult } from '@/lib/exec';

// 使用 vi.hoisted 确保 mock 函数在 vi.mock 之前可用
const { mockSpawnAsync } = vi.hoisted(() => ({
  mockSpawnAsync: vi.fn(),
}));

// Mock 依赖
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appConfig: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('@/lib/exec', () => ({
  spawnAsync: mockSpawnAsync,
}));

// Mock 文件系统：隔离真实 ~/.qwen 目录，验证 settings.json 的读写行为
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: actual.readFileSync,
  };
});

import { runQwen } from '@/lib/qwen/runner';
import { writeFileSync, existsSync } from 'fs';
import { prisma } from '@/lib/prisma';

const findUniqueMock = prisma.appConfig.findUnique as unknown as ReturnType<typeof vi.fn>;
const existsSyncMock = existsSync as unknown as ReturnType<typeof vi.fn>;
const writeFileSyncMock = writeFileSync as unknown as ReturnType<typeof vi.fn>;

/** 模拟仪表盘「设置」页已填写 settings.json 内容（存于 AppConfig） */
function mockSettingsConfigured(value = '{"api_key":"test","model":"qwen-plus"}') {
  findUniqueMock.mockResolvedValue({ configValue: value });
}

function successResult(stdout: string): SpawnResult {
  return { stdout, stderr: '', exitCode: 0 };
}

function failureResult(stderr: string, exitCode = 1): SpawnResult {
  return { stdout: '', stderr, exitCode };
}

describe('Qwen Runner - ENOENT 处理', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSpawnAsync.mockRejectedValue(
      Object.assign(new Error('spawn qwen ENOENT'), { code: 'ENOENT' })
    );
    // 走到执行路径的用例需要 settings.json 已配置
    mockSettingsConfigured();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('qwen 不存在时应立即返回失败，不进入重试循环', async () => {
    const result = await runQwen('test prompt', {
      sessionId: 'test-session-1',
    });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.output).toContain('qwen CLI 未安装');
    expect(mockSpawnAsync).toHaveBeenCalledTimes(1);
  });

  it('qwen 不存在时应返回安装指引', async () => {
    const result = await runQwen('fix this issue', {
      sessionId: 'test-session-2',
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain('npm install -g @qwen-code/qwen-code@latest');
  });

  it('qwen 不存在时应返回正确的 sessionId', async () => {
    const result = await runQwen('test', {
      sessionId: 'test-session-3',
    });

    expect(result.sessionId).toBe('test-session-3');
    expect(result.success).toBe(false);
  });

  it('qwen 正常执行成功时应返回 success: true', async () => {
    mockSpawnAsync.mockResolvedValue(successResult('Task completed successfully.'));

    const result = await runQwen('fix the bug', {
      sessionId: 'test-session-ok',
    });

    expect(result.success).toBe(true);
    expect(result.output).toBe('Task completed successfully.');
    expect(result.attempts).toBe(1);
  });

  it('非 ENOENT 错误不应被当作 notFound', async () => {
    let callCount = 0;
    mockSpawnAsync.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return successResult('qwen version 1.0.0');
      return failureResult('connect ECONNREFUSED');
    });

    // 只验证首次执行不触发 notFound 早退路径
    const p = runQwen('network task', {
      sessionId: 'not-found-test',
      timeout: 100,
    });

    // 等 100ms 让首次调用完成
    await new Promise((r) => setTimeout(r, 100));

    // 验证预检 + 首次执行 = 2次调用
    expect(mockSpawnAsync.mock.calls.length).toBeGreaterThanOrEqual(2);
    // 验证不是 ENOENT（notFound 路径不会被触发）
    expect(mockSpawnAsync.mock.calls[0][0]).toBe('qwen');

    // 不等待重试循环，直接验证调用次数即可
    p.catch(() => {});
  });
});

describe('Qwen Runner - 预检', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsConfigured();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('预检阶段 qwen 不存在应直接返回', async () => {
    mockSpawnAsync.mockRejectedValue(
      Object.assign(new Error('spawn qwen ENOENT'), { code: 'ENOENT' })
    );

    const result = await runQwen('test', { sessionId: 'precheck-test' });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.output).toContain('qwen CLI 未安装');
  });

  it('预检通过但执行失败（非 ENOENT）应继续执行而非立即退出', async () => {
    let callCount = 0;
    mockSpawnAsync.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return successResult('qwen version 1.0.0');
      return failureResult('connect ECONNREFUSED');
    });

    const p = runQwen('network task', {
      sessionId: 'net-error-test',
      timeout: 100,
    });

    await new Promise((r) => setTimeout(r, 100));

    // 预检通过 + 首次执行 = 2次调用
    expect(mockSpawnAsync.mock.calls.length).toBeGreaterThanOrEqual(2);
    p.catch(() => {});
  });
});

describe('Qwen Runner - settings.json 配置校验', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 默认：数据库未配置、本地无 settings.json 文件
    findUniqueMock.mockResolvedValue(null);
    existsSyncMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('CLI 正常但 settings.json 未配置时应快速失败并给出指引', async () => {
    mockSpawnAsync.mockResolvedValue(successResult('qwen version 1.0.0'));

    const result = await runQwen('test prompt', { sessionId: 'settings-missing' });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.output).toContain('settings.json 未配置');
    expect(result.output).toContain('仪表盘');
    // 仅预检调用一次，不进入真实执行与重试
    expect(mockSpawnAsync).toHaveBeenCalledTimes(1);
  });

  it('数据库中已填写 settings.json 时应写入文件并正常执行', async () => {
    const content = '{"api_key":"k","model":"qwen-plus"}';
    mockSettingsConfigured(content);
    mockSpawnAsync.mockResolvedValue(successResult('done'));

    const result = await runQwen('test prompt', { sessionId: 'settings-ok' });

    expect(result.success).toBe(true);
    expect(writeFileSyncMock).toHaveBeenCalled();
    const [path, written] = writeFileSyncMock.mock.calls[0];
    expect(String(path)).toContain('.qwen');
    expect(written).toBe(content);

    // 注入 qwen CLI 的环境变量不应再包含已废弃的 API 密钥变量
    const opts = mockSpawnAsync.mock.calls[1][2] as { env: Record<string, string> };
    expect(opts.env.UNLIMITED_OPENAI_API_KEY).toBeUndefined();
  });

  it('数据库未配置但存在手工维护的 settings.json 时应继续执行', async () => {
    existsSyncMock.mockImplementation((p: unknown) => String(p).endsWith('settings.json'));
    mockSpawnAsync.mockResolvedValue(successResult('ok'));

    const result = await runQwen('test prompt', { sessionId: 'settings-manual' });

    expect(result.success).toBe(true);
    // 手工维护场景不应覆盖用户的 settings.json
    expect(writeFileSyncMock).not.toHaveBeenCalled();
  });
});
