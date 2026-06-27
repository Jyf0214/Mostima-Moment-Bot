/**
 * CI/CD 统一类型定义
 *
 * 集中管理 Webhook 载荷类型、CI 管线载荷类型，
 * 消除多处重复定义和类型不兼容问题。
 *
 * 设计原则：
 * - 所有字段使用可选标记，匹配真实 Webhook 数据特征
 * - 调用方在需要必填字段时自行做运行时校验
 */

// ── CI 管线载荷类型（供 runner.ts 使用） ──

/** Pull Request 事件载荷 */
export interface PRPayload {
  action?: string;
  pull_request?: {
    number?: number;
    head?: { ref?: string; sha?: string };
    base?: { ref?: string };
    user?: { login?: string };
  };
  repository?: { full_name?: string };
}

/** Issue Comment 事件载荷 */
export interface CommentPayload {
  action?: string;
  comment?: { body?: string; user?: { login?: string } };
  issue?: { number?: number };
}

/** Workflow Run 事件载荷 */
export interface WorkflowPayload {
  workflow_run?: { name?: string; conclusion?: string };
}

// ── CI 检查结果类型 ──

/** 单步检查结果 */
export interface CheckResult {
  step: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  output?: string;
  exitCode: number;
}

// ── GitHub Webhook 原始载荷类型（供 webhook/github.ts 使用） ──

/** pull_request 事件原始载荷 */
export interface PREventPayload {
  action?: string;
  pull_request?: {
    number?: number;
    head?: { sha?: string };
    base?: { ref?: string };
  };
  repository?: { full_name?: string };
}

/** issues / issue_comment 事件原始载荷 */
export interface IssueEventPayload {
  action?: string;
  issue?: {
    number?: number;
    title?: string;
    body?: string;
    labels?: Array<{ name?: string }>;
    author_association?: string;
    pull_request?: unknown;
  };
  label?: { name?: string };
  comment?: {
    body?: string;
    author_association?: string;
    user?: { login?: string };
  };
  repository?: { full_name?: string };
}

/** push 事件原始载荷 */
export interface PushEventPayload {
  ref?: string;
  head_commit?: { id?: string; message?: string } | null;
  pusher?: { name?: string };
  sender?: { login?: string };
  repository?: { full_name?: string };
}

/** installation 事件原始载荷 */
export interface InstallationEventPayload {
  action?: string;
  installation?: {
    id?: number;
    account?: {
      login?: string;
      id?: number;
      type?: string;
      avatar_url?: string;
    };
  };
}

/** workflow_job 事件原始载荷 */
export interface WorkflowJobEventPayload {
  action?: string;
  workflow_job?: {
    id?: number;
    name?: string;
    status?: string;
    conclusion?: string | null;
  };
  repository?: { full_name?: string };
}
