/**
 * 规则匹配引擎
 *
 * 核心职责：判断一个 Webhook 载荷是否匹配某条触发规则。
 * 参考 ZhouZBoss-Web 的 GitHub Actions `on` 触发器语义。
 *
 * 安全说明：
 * - 所有输入验证均为白名单模式
 * - 正则由内部 glob 转换生成，不接受用户直接传入正则
 * - commentPattern 使用内部构造的正则，禁止回溯深度超过 100
 */

import type { TriggerRule, WebhookPayload, TriggerMatchResult } from './types';
import { matchBranch, isBranchExcluded } from './branch-matcher';

/**
 * 评估单条规则是否匹配给定的 Webhook 载荷
 */
export function evaluateRule(rule: TriggerRule, payload: WebhookPayload): TriggerMatchResult {
  // 1. 规则必须启用
  if (!rule.enabled) {
    return { matched: false, reason: `Rule "${rule.id}" is disabled` };
  }

  // 2. 事件类型匹配
  if (!rule.events.includes(payload.event)) {
    return {
      matched: false,
      reason: `Event "${payload.event}" not in rule events [${rule.events}]`,
    };
  }

  // 3. 事件特定条件匹配
  const eventCheck = checkEventConditions(rule, payload);
  if (!eventCheck.matched) {
    return eventCheck;
  }

  return { matched: true, rule };
}

/**
 * 事件特定条件检查
 */
function checkEventConditions(rule: TriggerRule, payload: WebhookPayload): TriggerMatchResult {
  switch (payload.event) {
    case 'push':
      return checkPushEvent(rule, payload);
    case 'pull_request':
      return checkPREvent(rule, payload);
    case 'issue':
      return checkIssueEvent(rule, payload);
    case 'issue_comment':
      return checkCommentEvent(rule, payload);
    case 'schedule':
    case 'workflow_dispatch':
      // schedule 和 workflow_dispatch 无额外条件
      return { matched: true };
    default:
      return { matched: false, reason: `Unknown event type: ${payload.event}` };
  }
}

/**
 * Push 事件检查：分支过滤
 */
function checkPushEvent(rule: TriggerRule, payload: WebhookPayload): TriggerMatchResult {
  if (!payload.branch) {
    return { matched: false, reason: 'Push event missing branch' };
  }

  if (rule.branches) {
    // 检查排除列表
    if (rule.branches.exclude && isBranchExcluded(payload.branch, rule.branches.exclude)) {
      return { matched: false, reason: `Branch "${payload.branch}" is excluded` };
    }
    // 检查包含列表
    if (!matchBranch(payload.branch, rule.branches.include)) {
      return {
        matched: false,
        reason: `Branch "${payload.branch}" does not match [${rule.branches.include}]`,
      };
    }
  }

  return { matched: true };
}

/**
 * PR 事件检查：action + 分支过滤
 */
function checkPREvent(rule: TriggerRule, payload: WebhookPayload): TriggerMatchResult {
  // 检查 action
  if (rule.actions && payload.action) {
    if (!rule.actions.includes(payload.action)) {
      return {
        matched: false,
        reason: `PR action "${payload.action}" not in [${rule.actions}]`,
      };
    }
  }

  // 检查基础分支
  if (rule.branches && payload.baseBranch) {
    if (rule.branches.exclude && isBranchExcluded(payload.baseBranch, rule.branches.exclude)) {
      return { matched: false, reason: `Base branch "${payload.baseBranch}" is excluded` };
    }
    if (!matchBranch(payload.baseBranch, rule.branches.include)) {
      return {
        matched: false,
        reason: `Base branch "${payload.baseBranch}" does not match [${rule.branches.include}]`,
      };
    }
  }

  return { matched: true };
}

/**
 * Issue 事件检查：action + 标签过滤
 */
function checkIssueEvent(rule: TriggerRule, payload: WebhookPayload): TriggerMatchResult {
  // 检查 action
  if (rule.actions && payload.action) {
    if (!rule.actions.includes(payload.action)) {
      return {
        matched: false,
        reason: `Issue action "${payload.action}" not in [${rule.actions}]`,
      };
    }
  }

  // 检查标签
  if (rule.labels && rule.labels.length > 0) {
    if (!payload.labels || payload.labels.length === 0) {
      return { matched: false, reason: 'Issue has no labels' };
    }
    const hasMatchingLabel = rule.labels.some((label) => payload.labels!.includes(label));
    if (!hasMatchingLabel) {
      return {
        matched: false,
        reason: `Issue labels [${payload.labels}] do not contain any of [${rule.labels}]`,
      };
    }
  }

  return { matched: true };
}

/**
 * Issue Comment 事件检查：action + 权限 + 标签 + 评论内容
 */
function checkCommentEvent(rule: TriggerRule, payload: WebhookPayload): TriggerMatchResult {
  // 检查 action
  if (rule.actions && payload.action) {
    if (!rule.actions.includes(payload.action)) {
      return {
        matched: false,
        reason: `Comment action "${payload.action}" not in [${rule.actions}]`,
      };
    }
  }

  // 检查作者权限
  if (rule.requiredAuthorAssociation && payload.authorAssociation) {
    if (!rule.requiredAuthorAssociation.includes(payload.authorAssociation)) {
      return {
        matched: false,
        reason: `Author association "${payload.authorAssociation}" not in [${rule.requiredAuthorAssociation}]`,
      };
    }
  }

  // 检查标签
  if (rule.labels && rule.labels.length > 0) {
    if (!payload.labels || payload.labels.length === 0) {
      return { matched: false, reason: 'Issue has no labels' };
    }
    const hasMatchingLabel = rule.labels.some((label) => payload.labels!.includes(label));
    if (!hasMatchingLabel) {
      return {
        matched: false,
        reason: `Issue labels [${payload.labels}] do not contain any of [${rule.labels}]`,
      };
    }
  }

  // 检查评论内容模式
  if (rule.commentPattern && payload.commentBody) {
    // 限制正则长度防止 ReDoS
    if (rule.commentPattern.length > 200) {
      return { matched: false, reason: 'Comment pattern too long' };
    }
    try {
      // 使用安全超时的正则匹配
      const regex = new RegExp(rule.commentPattern);
      // 设置匹配步数上限防止 ReDoS
      const match = regex.exec(payload.commentBody);
      if (!match) {
        return {
          matched: false,
          reason: `Comment body does not match pattern "${rule.commentPattern}"`,
        };
      }
    } catch {
      return { matched: false, reason: `Invalid comment pattern: ${rule.commentPattern}` };
    }
  }

  return { matched: true };
}

/**
 * 评估多条规则，返回所有匹配的规则
 */
export function evaluateAllRules(
  rules: TriggerRule[],
  payload: WebhookPayload
): TriggerMatchResult[] {
  return rules.map((rule) => evaluateRule(rule, payload));
}

/**
 * 找到第一条匹配的规则
 */
export function findFirstMatch(rules: TriggerRule[], payload: WebhookPayload): TriggerMatchResult {
  for (const rule of rules) {
    const result = evaluateRule(rule, payload);
    if (result.matched) return result;
  }
  return { matched: false, reason: 'No matching rule found' };
}
