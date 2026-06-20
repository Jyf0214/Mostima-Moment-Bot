/**
 * CI/CD 触发规则类型定义
 *
 * 参考 ZhouZBoss-Web 的 GitHub Actions 工作流设计，将 YAML 触发器语义
 * 转化为 JS 可执行的规则配置。
 */

/** 支持的 GitHub 事件类型 */
export type TriggerEvent =
  | 'push'
  | 'pull_request'
  | 'issue'
  | 'issue_comment'
  | 'schedule'
  | 'workflow_dispatch';

/** pull_request / issue / issue_comment 支持的 action */
export type PRAction = 'opened' | 'synchronize' | 'reopened' | 'closed' | 'labeled' | 'unlabeled';
export type IssueAction = 'opened' | 'labeled' | 'unlabeled' | 'closed' | 'reopened';
export type CommentAction = 'created' | 'edited' | 'deleted';

/** 管理员关联类型（GitHub author_association 字段） */
export type AuthorAssociation =
  | 'OWNER'
  | 'MEMBER'
  | 'COLLABORATOR'
  | 'CONTRIBUTOR'
  | 'FIRST_TIME_CONTRIBUTOR'
  | 'FIRST_TIMER'
  | 'NONE';

/** 单条触发规则 */
export interface TriggerRule {
  /** 规则唯一 ID */
  id: string;
  /** 规则名称（人类可读） */
  name: string;
  /** 是否启用 */
  enabled: boolean;
  /** 触发的事件类型列表 */
  events: TriggerEvent[];
  /** 分支过滤（支持 glob 模式，如 main, feature/*） */
  branches?: BranchFilter;
  /** 动作过滤（仅 push 事件用 branches，其他事件用 actions） */
  actions?: string[];
  /** 标签过滤（仅 issue/issue_comment 事件） */
  labels?: string[];
  /** 评论内容匹配（正则字符串，仅 issue_comment 事件） */
  commentPattern?: string;
  /** 权限要求（仅 issue_comment 事件） */
  requiredAuthorAssociation?: AuthorAssociation[];
  /** 并发组配置（防止重复运行） */
  concurrency?: ConcurrencyConfig;
  /** 触发后执行的检查步骤 */
  checks: CheckStep[];
}

/** 分支过滤配置 */
export interface BranchFilter {
  /** 匹配的分支模式列表（glob，如 ['main', 'master', 'feature/*']） */
  include: string[];
  /** 排除的分支模式列表 */
  exclude?: string[];
}

/** 并发控制配置 */
export interface ConcurrencyConfig {
  /** 并发组 key 模板（支持 {{event}}, {{ref}}, {{pr_number}} 占位符） */
  group: string;
  /** 是否取消正在进行的旧运行 */
  cancelInProgress: boolean;
}

/** 单个检查步骤 */
export interface CheckStep {
  /** 步骤名称 */
  name: string;
  /** 检查类型 */
  type: 'lint' | 'typecheck' | 'build' | 'test' | 'security_scan' | 'custom';
  /** 自定义命令（type=custom 时使用） */
  command?: string;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 是否允许失败（不阻断流水线） */
  allowFailure?: boolean;
}

/** Webhook 事件载荷（标准化后的内部格式） */
export interface WebhookPayload {
  /** GitHub 事件类型 */
  event: TriggerEvent;
  /** 事件动作（如 opened, synchronize, created 等） */
  action?: string;
  /** 分支名（push/PR 事件） */
  branch?: string;
  /** 基础分支名（PR 事件） */
  baseBranch?: string;
  /** PR 编号 */
  prNumber?: number;
  /** Issue 编号 */
  issueNumber?: number;
  /** 提交 SHA */
  commitSha?: string;
  /** 提交者/作者 */
  author?: string;
  /** 作者关联类型 */
  authorAssociation?: AuthorAssociation;
  /** Issue/PR 标签列表 */
  labels?: string[];
  /** 评论内容 */
  commentBody?: string;
  /** 仓库全名 (owner/repo) */
  repository?: string;
  /** 触发时间 */
  timestamp?: number;
}

/** 触发规则匹配结果 */
export interface TriggerMatchResult {
  /** 是否匹配 */
  matched: boolean;
  /** 匹配到的规则 */
  rule?: TriggerRule;
  /** 未匹配原因（仅不匹配时） */
  reason?: string;
}

/** 并发检查结果 */
export interface ConcurrencyCheckResult {
  /** 是否允许运行 */
  allowed: boolean;
  /** 并发组 key */
  groupKey: string;
  /** 如果不允许，原因是什么 */
  reason?: string;
  /** 是否取消了旧运行 */
  cancelledPrevious?: boolean;
}
