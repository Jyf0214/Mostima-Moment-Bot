/**
 * 默认触发规则配置
 *
 * 参考 ZhouZBoss-Web 的 5 个工作流，转化为 JS 规则配置：
 * 1. js-ci.yml    → push to main/master + PR to main/master → CI 验证
 * 2. webpack.yml  → push to main + PR to main → 构建检查
 * 3. qwen-security-auditor.yml → PR opened/synchronize → 安全审计
 * 4. qwen-issue-solver.yml → Issue labeled auto-fix / comment @{BOT_NAME} /fix → 自动修复
 * 5. qwen-scheduled-scanner.yml → 定期巡检
 */

import type { TriggerRule } from './types';
import { getBotSlug } from '@/lib/ci/config';

/**
 * CI 验证规则（对应 js-ci.yml）
 * 触发条件：push 到 main/master 或 PR 到 main/master
 */
export const CI_VERIFICATION_RULE: TriggerRule = {
  id: 'ci-verification',
  name: 'JS/TS Continuous Integration',
  enabled: true,
  events: ['push', 'pull_request'],
  branches: {
    include: ['main', 'master'],
  },
  concurrency: {
    group: '{{event}}-{{ref}}',
    cancelInProgress: true,
  },
  checks: [
    { name: 'Install Dependencies', type: 'custom', command: 'npm ci' },
    { name: 'Lint Check', type: 'lint', command: 'npm run lint --if-present' },
    { name: 'Type Check', type: 'typecheck', command: 'npx tsc --noEmit' },
    { name: 'Build Check', type: 'build', command: 'npm run build --if-present' },
    { name: 'Unit Tests', type: 'test', command: 'npm run test --if-present' },
  ],
};

/**
 * 安全审计规则（对应 qwen-security-auditor.yml）
 * 触发条件：PR opened 或 synchronize
 */
export const SECURITY_AUDIT_RULE: TriggerRule = {
  id: 'security-audit',
  name: 'Security Audit',
  enabled: true,
  events: ['pull_request'],
  actions: ['opened', 'synchronize'],
  concurrency: {
    group: 'security-audit-pr-{{pr_number}}',
    cancelInProgress: true,
  },
  checks: [{ name: 'Security Scan', type: 'security_scan' }],
};

/**
 * 自动修复规则（对应 qwen-issue-solver.yml）
 * 触发条件：Issue 被贴 auto-fix 标签，或评论 @{BOT_NAME} /fix
 *
 * 使用函数生成，因为 commentPattern 依赖运行时的 BOT_NAME 配置。
 */
export function getAutoFixRule(): TriggerRule {
  const botSlug = getBotSlug();
  return {
    id: 'auto-fix',
    name: 'Autonomous Issue Solver',
    enabled: true,
    events: ['issue', 'issue_comment'],
    labels: ['auto-fix'],
    requiredAuthorAssociation: ['OWNER', 'MEMBER', 'COLLABORATOR'],
    commentPattern: `^@${botSlug}\\s+/fix`,
    concurrency: {
      group: 'auto-fix-issue-{{issue_number}}',
      cancelInProgress: false,
    },
    checks: [{ name: 'Run Auto Fix', type: 'custom', command: 'auto-fix' }],
  };
}

/** @deprecated 使用 getAutoFixRule() 代替，此导出仅供测试向后兼容 */
export const AUTO_FIX_RULE: TriggerRule = getAutoFixRule();

/**
 * 构建检查规则（对应 webpack.yml）
 * 触发条件：push 到 main 或 PR 到 main
 */
export const BUILD_CHECK_RULE: TriggerRule = {
  id: 'build-check',
  name: 'Build Verification',
  enabled: true,
  events: ['push', 'pull_request'],
  branches: {
    include: ['main'],
  },
  concurrency: {
    group: 'build-{{event}}-{{ref}}',
    cancelInProgress: true,
  },
  checks: [
    { name: 'Install', type: 'custom', command: 'npm ci' },
    { name: 'Build', type: 'build', command: 'npm run build' },
  ],
};

/**
 * 所有默认规则
 */
export function getDefaultRules(): TriggerRule[] {
  return [CI_VERIFICATION_RULE, SECURITY_AUDIT_RULE, getAutoFixRule(), BUILD_CHECK_RULE];
}

/** @deprecated 使用 getDefaultRules() 代替，此导出仅供测试向后兼容 */
export const DEFAULT_RULES: TriggerRule[] = getDefaultRules();
