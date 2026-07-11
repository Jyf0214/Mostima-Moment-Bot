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

import { runQwen } from '@/lib/qwen/runner';

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
