import { describe, it, expect } from 'vitest';
import { spawnAsync } from '@/lib/exec';

describe('spawnAsync 子进程执行', () => {
  it('应该正确执行命令并返回 stdout', async () => {
    const result = await spawnAsync('echo', ['hello world']);
    expect(result.stdout.trim()).toBe('hello world');
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('应该正确捕获 stderr', async () => {
    const result = await spawnAsync('node', ['-e', 'console.error("error output")']);
    expect(result.stderr.trim()).toBe('error output');
    expect(result.exitCode).toBe(0);
  });

  it('应该返回非零退出码', async () => {
    const result = await spawnAsync('node', ['-e', 'process.exit(1)']);
    expect(result.exitCode).toBe(1);
  });

  it('应该处理命令不存在的情况', async () => {
    await expect(spawnAsync('nonexistent-command-xyz', [])).rejects.toThrow();
  });

  it('应该支持 cwd 选项', async () => {
    const result = await spawnAsync('pwd', [], { cwd: '/tmp' });
    expect(result.stdout.trim()).toBe('/tmp');
  });

  it('应该支持 env 选项', async () => {
    const result = await spawnAsync('node', ['-e', 'console.log(process.env.TEST_VAR)'], {
      env: { ...process.env, TEST_VAR: 'test-value' },
    });
    expect(result.stdout.trim()).toBe('test-value');
  });

  it('空参数数组应该正常工作', async () => {
    const result = await spawnAsync('echo', []);
    expect(result.exitCode).toBe(0);
  });
});
