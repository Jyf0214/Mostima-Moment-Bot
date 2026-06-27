/**
 * Webhook 触发规则匹配入口
 *
 * 从 GitHub Webhook 原始载荷中提取标准化字段，然后调用规则引擎匹配。
 *
 * 安全说明：
 * - 所有 payload 字段都经过类型验证和长度截断
 * - 不直接使用 payload 中的用户输入执行命令
 * - 分支名、标签名等均经过白名单字符过滤
 */

import type { TriggerRule, WebhookPayload, TriggerMatchResult, AuthorAssociation } from './types';
import { evaluateAllRules, findFirstMatch } from './rule-evaluator';
import { ConcurrencyManager, renderConcurrencyGroup } from './concurrency';
import type { ConcurrencyCheckResult } from './types';
import type { PRPayload } from '../types';

/** 分支名安全字符白名单 */
const SAFE_BRANCH_CHARS = /^[a-zA-Z0-9._\-\/]+$/;

/** 标签名最大长度 */
const MAX_LABEL_LENGTH = 100;

/** 评论内容最大长度 */
const MAX_COMMENT_LENGTH = 10000;

// ── 载荷内部类型 ──

interface PushPayload {
  ref?: string;
  after?: string;
  pusher?: { name?: string };
  sender?: { login?: string };
  repository?: { full_name?: string };
}

interface IssuePayload {
  action?: string;
  issue?: {
    number?: number;
    user?: { login?: string };
    author_association?: string;
    labels?: Array<{ name?: string }>;
    pull_request?: unknown;
  };
  repository?: { full_name?: string };
}

interface CommentTriggerPayload {
  action?: string;
  issue?: {
    number?: number;
    labels?: Array<{ name?: string }>;
    pull_request?: unknown;
  };
  comment?: {
    user?: { login?: string };
    author_association?: string;
    body?: string;
  };
  repository?: { full_name?: string };
}

/**
 * 从 GitHub Webhook 载荷中提取标准化的内部格式
 */
export function normalizePayload(
  eventName: string,
  payload: Record<string, unknown>
): WebhookPayload {
  const base: WebhookPayload = {
    event: eventName as WebhookPayload['event'],
    timestamp: Date.now(),
  };

  switch (eventName) {
    case 'push': {
      const p = payload as unknown as PushPayload;
      const ref = String(p.ref || '');
      const branch = ref.startsWith('refs/heads/') ? ref.slice(11) : ref;
      return {
        ...base,
        branch: sanitizeBranch(branch),
        commitSha: sanitizeSha(String(p.after || '')),
        author: sanitizeString(String(p.pusher?.name || p.sender?.login || '')),
        repository: String(p.repository?.full_name || ''),
      };
    }

    case 'pull_request': {
      const p = payload as unknown as PRPayload;
      const pr = p.pull_request;
      const action = String(p.action || '');
      return {
        ...base,
        action,
        branch: sanitizeBranch(String(pr?.head?.ref || '')),
        baseBranch: sanitizeBranch(String(pr?.base?.ref || '')),
        prNumber: Number(pr?.number) || 0,
        commitSha: sanitizeSha(String(pr?.head?.sha || '')),
        author: sanitizeString(String(pr?.user?.login || '')),
        repository: String(p.repository?.full_name || ''),
      };
    }

    case 'issue': {
      const p = payload as unknown as IssuePayload;
      const issue = p.issue;
      const action = String(p.action || '');
      return {
        ...base,
        action,
        issueNumber: Number(issue?.number) || 0,
        author: sanitizeString(String(issue?.user?.login || '')),
        authorAssociation: sanitizeAssociation(String(issue?.author_association || '')),
        labels: extractLabels(issue),
        repository: String(p.repository?.full_name || ''),
      };
    }

    case 'issue_comment': {
      const p = payload as unknown as CommentTriggerPayload;
      const issue = p.issue;
      const comment = p.comment;
      const action = String(p.action || '');
      return {
        ...base,
        action,
        issueNumber: Number(issue?.number) || 0,
        prNumber: issue?.pull_request ? Number(issue.number) : undefined,
        author: sanitizeString(String(comment?.user?.login || '')),
        authorAssociation: sanitizeAssociation(String(comment?.author_association || '')),
        labels: extractLabels(issue),
        commentBody: sanitizeComment(String(comment?.body || '')),
        repository: String(p.repository?.full_name || ''),
      };
    }

    default:
      return base;
  }
}

/**
 * 安全地匹配 webhook 载荷与规则列表
 */
export function matchWebhook(
  rules: TriggerRule[],
  eventName: string,
  payload: Record<string, unknown>
): TriggerMatchResult[] {
  const normalized = normalizePayload(eventName, payload);
  return evaluateAllRules(rules, normalized);
}

/**
 * 安全地匹配并返回第一条匹配规则
 */
export function matchWebhookFirst(
  rules: TriggerRule[],
  eventName: string,
  payload: Record<string, unknown>
): TriggerMatchResult {
  const normalized = normalizePayload(eventName, payload);
  return findFirstMatch(rules, normalized);
}

/**
 * 检查并发控制
 */
export function checkConcurrency(
  concurrencyManager: ConcurrencyManager,
  config: { concurrency?: { group: string; cancelInProgress: boolean } },
  payload: WebhookPayload,
  runId: string
): ConcurrencyCheckResult {
  if (!config.concurrency) {
    return { allowed: true, groupKey: 'no-concurrency' };
  }

  const groupKey = renderConcurrencyGroup(config.concurrency.group, {
    event: payload.event,
    ref: payload.branch || payload.baseBranch || 'unknown',
    pr_number: payload.prNumber || 0,
    issue_number: payload.issueNumber || 0,
  });

  return concurrencyManager.check(
    { group: config.concurrency.group, cancelInProgress: config.concurrency.cancelInProgress },
    groupKey,
    runId
  );
}

// ── 输入消毒函数 ──

function sanitizeBranch(branch: string): string {
  if (!branch) return '';
  const truncated = branch.slice(0, 255);
  if (!SAFE_BRANCH_CHARS.test(truncated)) {
    return truncated.replace(/[^a-zA-Z0-9._\-\/]/g, '');
  }
  return truncated;
}

function sanitizeSha(sha: string): string {
  if (!sha) return '';
  return sha.slice(0, 40).replace(/[^a-f0-9]/gi, '');
}

function sanitizeString(s: string): string {
  if (!s) return '';
  return s.slice(0, 255).replace(/[^\w.\-@]/g, '');
}

function sanitizeAssociation(s: string): AuthorAssociation | undefined {
  const valid: AuthorAssociation[] = [
    'OWNER',
    'MEMBER',
    'COLLABORATOR',
    'CONTRIBUTOR',
    'FIRST_TIME_CONTRIBUTOR',
    'FIRST_TIMER',
    'NONE',
  ];
  return valid.includes(s as AuthorAssociation) ? (s as AuthorAssociation) : undefined;
}

function sanitizeComment(body: string): string {
  if (!body) return '';
  return body.slice(0, MAX_COMMENT_LENGTH);
}

function extractLabels(issue: Record<string, unknown> | undefined): string[] {
  if (!issue || !Array.isArray(issue.labels)) return [];
  return (issue.labels as Array<Record<string, unknown>>)
    .map((l) => String(l.name || ''))
    .filter((name) => name.length > 0 && name.length <= MAX_LABEL_LENGTH)
    .slice(0, 50);
}
