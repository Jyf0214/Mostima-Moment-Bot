import { describe, it, expect } from 'vitest';
import { matchBranch, isBranchExcluded } from '@/lib/ci/triggers/branch-matcher';

describe('分支名 Glob 匹配器', () => {
  describe('matchBranch', () => {
    it('应该精确匹配 main 分支', () => {
      expect(matchBranch('main', ['main'])).toBe(true);
      expect(matchBranch('master', ['main'])).toBe(false);
    });

    it('应该精确匹配多个分支', () => {
      expect(matchBranch('main', ['main', 'master'])).toBe(true);
      expect(matchBranch('master', ['main', 'master'])).toBe(true);
      expect(matchBranch('develop', ['main', 'master'])).toBe(false);
    });

    it('应该支持 * 通配符匹配', () => {
      expect(matchBranch('feature/login', ['feature/*'])).toBe(true);
      expect(matchBranch('feature/', ['feature/*'])).toBe(true);
      expect(matchBranch('feature/admin/dashboard', ['feature/*'])).toBe(false);
      expect(matchBranch('bugfix/issue-123', ['bugfix/*'])).toBe(true);
    });

    it('应该支持 ** 通配符匹配', () => {
      expect(matchBranch('feature/admin/dashboard', ['feature/**'])).toBe(true);
      expect(matchBranch('feature/', ['feature/**'])).toBe(true);
    });

    it('应该支持 ? 单字符通配符', () => {
      expect(matchBranch('release/1', ['release/?'])).toBe(true);
      expect(matchBranch('release/12', ['release/?'])).toBe(false);
    });

    it('应该支持花括号选项列表', () => {
      expect(matchBranch('main', ['{main,master}'])).toBe(true);
      expect(matchBranch('master', ['{main,master}'])).toBe(true);
      expect(matchBranch('develop', ['{main,master}'])).toBe(false);
    });

    it('应该拒绝空分支名', () => {
      expect(matchBranch('', ['main'])).toBe(false);
    });

    it('应该拒绝含 null 字节的分支名', () => {
      expect(matchBranch('main\0evil', ['main'])).toBe(false);
    });

    it('应该拒绝含 .. 的分支名（路径遍历）', () => {
      expect(matchBranch('../etc/passwd', ['*'])).toBe(false);
    });

    it('空模式列表应该返回 false', () => {
      expect(matchBranch('main', [])).toBe(false);
    });
  });

  describe('isBranchExcluded', () => {
    it('应该识别被排除的分支', () => {
      expect(isBranchExcluded('main', ['main', 'master'])).toBe(true);
      expect(isBranchExcluded('develop', ['main', 'master'])).toBe(false);
    });

    it('空排除列表应该返回 false', () => {
      expect(isBranchExcluded('main', [])).toBe(false);
    });
  });
});
