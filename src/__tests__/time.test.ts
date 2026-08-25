import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { timeAgo, formatDuration, shaShort } from '@/lib/time';

const tMock = vi.fn((key: string, opts?: Record<string, string>) => `${key}:${opts?.count ?? ''}`);

describe('lib/time formatDuration', () => {
  it('小于 1 秒显示毫秒', () => {
    expect(formatDuration(890)).toBe('890ms');
  });

  it('分钟以下显示秒', () => {
    expect(formatDuration(12000)).toBe('12s');
  });

  it('超过一分钟显示分秒组合', () => {
    expect(formatDuration(185000)).toBe('3m 5s');
  });
});

describe('lib/time shaShort', () => {
  it('空值返回占位符', () => {
    expect(shaShort(null)).toBe('—');
  });

  it('截取前 7 位', () => {
    expect(shaShort('abcdef1234567890')).toBe('abcdef1');
  });
});

describe('lib/time timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    tMock.mockClear();
  });

  it('60 秒内按秒显示', () => {
    expect(timeAgo('2026-08-25T11:59:30Z', tMock)).toBe('common.secondsAgo:30');
  });

  it('1 小时内按分钟显示', () => {
    expect(timeAgo('2026-08-25T11:55:00Z', tMock)).toBe('common.minutesAgo:5');
  });

  it('1 天内按小时显示', () => {
    expect(timeAgo('2026-08-25T10:00:00Z', tMock)).toBe('common.hoursAgo:2');
  });

  it('超过 1 天按天显示', () => {
    expect(timeAgo('2026-08-22T12:00:00Z', tMock)).toBe('common.daysAgo:3');
  });

  it('非法日期返回占位符', () => {
    expect(timeAgo('not-a-date', tMock)).toBe('-');
  });
});
