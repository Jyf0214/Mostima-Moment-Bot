import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyTextToClipboard } from '@/lib/clipboard';

function stubDom(execCommandResult: boolean) {
  const fakeTextarea = {
    value: '',
    style: {} as Record<string, string>,
    select: vi.fn(),
  };
  const fakeDocument = {
    createElement: vi.fn(() => fakeTextarea),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
    execCommand: vi.fn(() => execCommandResult),
  };
  return { fakeTextarea, fakeDocument };
}

describe('copyTextToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('空内容直接返回 false，不触碰剪贴板', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyTextToClipboard('')).resolves.toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('安全上下文下使用 navigator.clipboard 并返回 true', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyTextToClipboard('secret')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('secret');
  });

  it('clipboard 不可用时降级 execCommand 兜底', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('document is not focused');
    });
    const { fakeTextarea, fakeDocument } = stubDom(true);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.stubGlobal('document', fakeDocument);
    await expect(copyTextToClipboard('fallback')).resolves.toBe(true);
    expect(fakeTextarea.value).toBe('fallback');
    expect(fakeDocument.execCommand).toHaveBeenCalledWith('copy');
    expect(fakeDocument.body.removeChild).toHaveBeenCalledWith(fakeTextarea);
  });

  it('两条路径都失败时返回 false', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('denied');
    });
    const { fakeDocument } = stubDom(false);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.stubGlobal('document', fakeDocument);
    await expect(copyTextToClipboard('x')).resolves.toBe(false);
  });
});
