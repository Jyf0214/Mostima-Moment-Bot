import { describe, it, expect } from 'vitest';
import { validateBranchName, validatePRNumber, validateIssueNumber } from '@/lib/git/workspace';

describe('Git 工作区校验函数', () => {
  describe('validateBranchName', () => {
    it('应该接受合法的分支名', () => {
      expect(validateBranchName('main')).toBe('main');
      expect(validateBranchName('feature/login')).toBe('feature/login');
      expect(validateBranchName('bugfix/issue-123')).toBe('bugfix/issue-123');
      expect(validateBranchName('release/1.0.0')).toBe('release/1.0.0');
      expect(validateBranchName('feature/my-branch_name')).toBe('feature/my-branch_name');
    });

    it('应该拒绝空字符串', () => {
      expect(() => validateBranchName('')).toThrow('Unsafe branch name');
    });

    it('应该拒绝 null/undefined 类型', () => {
      expect(() => validateBranchName(null as any)).toThrow('Unsafe branch name');
      expect(() => validateBranchName(undefined as any)).toThrow('Unsafe branch name');
    });

    it('应该拒绝非字符串类型', () => {
      expect(() => validateBranchName(123 as any)).toThrow('Unsafe branch name');
    });

    it('应该拒绝包含空格的分支名', () => {
      expect(() => validateBranchName('feature my branch')).toThrow('Unsafe branch name');
    });

    it('应该拒绝包含 .. 的分支名（路径遍历）', () => {
      expect(() => validateBranchName('../etc/passwd')).toThrow('Unsafe branch name');
      expect(() => validateBranchName('feature..main')).toThrow('Unsafe branch name');
    });

    it('应该拒绝以 - 开头的分支名', () => {
      expect(() => validateBranchName('-dangerous')).toThrow('Unsafe branch name');
    });

    it('应该拒绝以 .lock 结尾的分支名', () => {
      expect(() => validateBranchName('main.lock')).toThrow('Unsafe branch name');
    });

    it('应该拒绝包含换行符的分支名', () => {
      expect(() => validateBranchName('main\ninjection')).toThrow('Unsafe branch name');
      expect(() => validateBranchName('main\rinjection')).toThrow('Unsafe branch name');
    });

    it('应该拒绝包含 null 字节的分支名', () => {
      expect(() => validateBranchName('main\0evil')).toThrow('Unsafe branch name');
    });

    it('应该拒绝包含 Git 特殊字符的分支名', () => {
      expect(() => validateBranchName('feature~branch')).toThrow('Unsafe branch name');
      expect(() => validateBranchName('feature^branch')).toThrow('Unsafe branch name');
      expect(() => validateBranchName('feature:branch')).toThrow('Unsafe branch name');
      expect(() => validateBranchName('feature?branch')).toThrow('Unsafe branch name');
      expect(() => validateBranchName('feature*branch')).toThrow('Unsafe branch name');
      expect(() => validateBranchName('feature[branch')).toThrow('Unsafe branch name');
      expect(() => validateBranchName('feature\\branch')).toThrow('Unsafe branch name');
    });

    it('应该拒绝包含 shell 元字符的分支名（通过 Git 非法字符检测）', () => {
      // validateBranchName 检查 Git refname 非法字符: ~^:?*[]\
      // 注意：; | 等 shell 元字符不在检测范围内，因为 execFileSync 不经过 shell
      expect(() => validateBranchName('main~branch')).toThrow('Unsafe branch name');
      expect(() => validateBranchName('main^branch')).toThrow('Unsafe branch name');
      expect(() => validateBranchName('main:branch')).toThrow('Unsafe branch name');
      expect(() => validateBranchName('main?branch')).toThrow('Unsafe branch name');
      expect(() => validateBranchName('main*branch')).toThrow('Unsafe branch name');
    });
  });

  describe('validatePRNumber', () => {
    it('应该接受正整数', () => {
      expect(validatePRNumber(1)).toBe(1);
      expect(validatePRNumber(42)).toBe(42);
      expect(validatePRNumber(999999)).toBe(999999);
    });

    it('应该拒绝零', () => {
      expect(() => validatePRNumber(0)).toThrow('Unsafe PR number');
    });

    it('应该拒绝负数', () => {
      expect(() => validatePRNumber(-1)).toThrow('Unsafe PR number');
    });

    it('应该拒绝小数', () => {
      expect(() => validatePRNumber(1.5)).toThrow('Unsafe PR number');
    });

    it('应该拒绝 NaN', () => {
      expect(() => validatePRNumber(NaN)).toThrow('Unsafe PR number');
    });

    it('应该拒绝 Infinity', () => {
      expect(() => validatePRNumber(Infinity)).toThrow('Unsafe PR number');
    });
  });

  describe('validateIssueNumber', () => {
    it('应该接受正整数', () => {
      expect(validateIssueNumber(1)).toBe(1);
      expect(validateIssueNumber(42)).toBe(42);
    });

    it('应该拒绝零', () => {
      expect(() => validateIssueNumber(0)).toThrow('Unsafe issue number');
    });

    it('应该拒绝负数', () => {
      expect(() => validateIssueNumber(-5)).toThrow('Unsafe issue number');
    });

    it('应该拒绝小数', () => {
      expect(() => validateIssueNumber(3.14)).toThrow('Unsafe issue number');
    });

    it('应该拒绝 NaN', () => {
      expect(() => validateIssueNumber(NaN)).toThrow('Unsafe issue number');
    });
  });
});
