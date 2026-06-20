---
name: cicd-trigger-rules-engine
description: CI/CD 触发规则引擎：参考 GitHub Actions 工作流原理，用 JS 实现可编程的事件触发匹配、分支过滤、权限校验、并发控制
source: auto-skill
extracted_at: '2026-06-20T22:19:17.515Z'
---

# CI/CD 触发规则引擎

## 概述

将 GitHub Actions YAML 工作流的触发器语义转化为 JS 可执行的规则配置系统。适用于需要在应用层（而非 CI 平台层）控制何时触发 CI/CD 检查的场景。

## 架构设计

```
src/lib/ci/triggers/
├── types.ts              # 类型定义
├── branch-matcher.ts     # Glob 分支匹配
├── rule-evaluator.ts     # 规则评估引擎
├── concurrency.ts        # 并发控制管理器
├── default-rules.ts      # 默认规则配置
└── index.ts              # 入口 + Webhook 载荷标准化
```

## 实现步骤

### 1. 定义类型系统（types.ts）

核心类型：

```typescript
// 支持的事件类型
type TriggerEvent =
  | 'push'
  | 'pull_request'
  | 'issue'
  | 'issue_comment'
  | 'schedule'
  | 'workflow_dispatch';

// 单条触发规则
interface TriggerRule {
  id: string;
  name: string;
  enabled: boolean;
  events: TriggerEvent[];
  branches?: BranchFilter; // 分支过滤（push/PR）
  actions?: string[]; // 动作过滤（PR/issue/comment）
  labels?: string[]; // 标签过滤（issue/comment）
  commentPattern?: string; // 评论正则（comment）
  requiredAuthorAssociation?: AuthorAssociation[]; // 权限要求
  concurrency?: ConcurrencyConfig; // 并发控制
  checks: CheckStep[]; // 检查步骤
}

// 标准化的 Webhook 载荷
interface WebhookPayload {
  event: TriggerEvent;
  action?: string;
  branch?: string;
  baseBranch?: string;
  prNumber?: number;
  issueNumber?: number;
  authorAssociation?: AuthorAssociation;
  labels?: string[];
  commentBody?: string;
}
```

### 2. 实现分支匹配器（branch-matcher.ts）

支持 glob 模式：`*`（不含 /）、`**`（含 /）、`?`、`{a,b}`

**安全要点**：

- 输入白名单过滤：`/[^a-zA-Z0-9_*?,/.\-[\]{}\\]/g`
- 禁止 null 字节和 `..` 路径遍历
- 每个 pattern 独立编译为 RegExp，无全局状态

```typescript
function globToRegex(pattern: string): RegExp {
  const sanitized = pattern.replace(/[^a-zA-Z0-9_*?,/.\-[\]{}\\]/g, '');
  // ... 转换逻辑
  return new RegExp(regexStr);
}

function matchBranch(branch: string, patterns: string[]): boolean {
  if (!branch || branch.includes('\0') || branch.includes('..')) return false;
  return patterns.some((p) => globToRegex(p).test(branch));
}
```

### 3. 实现规则评估引擎（rule-evaluator.ts）

按事件类型分发检查：

| 事件            | 检查内容                        |
| --------------- | ------------------------------- |
| `push`          | 分支 include/exclude            |
| `pull_request`  | action + 基础分支               |
| `issue`         | action + 标签                   |
| `issue_comment` | action + 权限 + 标签 + 评论正则 |
| `schedule`      | 无额外条件                      |

```typescript
function evaluateRule(rule: TriggerRule, payload: WebhookPayload): TriggerMatchResult {
  if (!rule.enabled) return { matched: false, reason: 'disabled' };
  if (!rule.events.includes(payload.event)) return { matched: false, reason: 'event mismatch' };
  return checkEventConditions(rule, payload);
}
```

### 4. 实现并发控制（concurrency.ts）

参考 GitHub Actions 的 `concurrency` 机制：

```typescript
class ConcurrencyManager {
  private active = new Map<string, ConcurrencyEntry>();

  check(config, groupKey, runId): ConcurrencyCheckResult {
    const existing = this.active.get(groupKey);
    if (existing) {
      if (config.cancelInProgress) {
        existing.abortController.abort();  // 取消旧运行
        this.active.set(groupKey, { runId, ... });
        return { allowed: true, cancelledPrevious: true };
      }
      return { allowed: false, reason: 'already active' };
    }
    this.active.set(groupKey, { runId, ... });
    return { allowed: true };
  }
}
```

**安全要点**：

- groupKey 经过 sanitize（只允许 `[a-zA-Z0-9_\-/]`）
- 最大组数限制（1000）防内存泄漏
- 过期条目自动清理（1 小时 TTL）

### 5. Webhook 载荷标准化（index.ts）

将原始 GitHub webhook 载荷转为内部格式：

```typescript
function normalizePayload(eventName: string, payload: Record<string, unknown>): WebhookPayload {
  // 使用专用接口类型断言，避免 Record<string, unknown> 的属性访问问题
  const p = payload as unknown as PushPayload;
  // 提取字段 + 输入消毒
}
```

**输入消毒函数**：

- `sanitizeBranch`: 白名单字符 + 255 字符截断
- `sanitizeSha`: 只允许十六进制 + 40 字符截断
- `sanitizeString`: 只允许 `[\w.\-@]` + 255 字符截断
- `sanitizeAssociation`: 白名单验证 author_association
- `extractLabels`: 限制标签数量（50）和长度（100）

### 6. 配置默认规则（default-rules.ts）

参考 ZhouZBoss-Web 的 5 个工作流：

```typescript
const CI_VERIFICATION_RULE: TriggerRule = {
  id: 'ci-verification',
  events: ['push', 'pull_request'],
  branches: { include: ['main', 'master'] },
  concurrency: { group: '{{event}}-{{ref}}', cancelInProgress: true },
  checks: [
    { name: 'Lint', type: 'lint' },
    { name: 'Type Check', type: 'typecheck' },
    { name: 'Build', type: 'build' },
    { name: 'Test', type: 'test' },
  ],
};
```

## 安全检查清单

| 风险     | 防护措施                             |
| -------- | ------------------------------------ |
| 注入攻击 | 输入白名单过滤，禁止 shell 特殊字符  |
| ReDoS    | 正则长度限制（200 字符），无嵌套量词 |
| 路径遍历 | 禁止 `..` 和 null 字节               |
| 内存泄漏 | 最大并发组数限制 + TTL 自动清理      |
| 类型混淆 | 使用专用接口类型断言，不用 `as any`  |

## 测试模式

### 分支匹配测试

```typescript
describe('matchBranch', () => {
  it('应该精确匹配 main', () => {
    expect(matchBranch('main', ['main'])).toBe(true);
  });
  it('应该支持 * 通配符', () => {
    expect(matchBranch('feature/login', ['feature/*'])).toBe(true);
  });
  it('应该拒绝含 .. 的分支名', () => {
    expect(matchBranch('../etc/passwd', ['*'])).toBe(false);
  });
});
```

### 规则评估测试

```typescript
describe('evaluateRule', () => {
  it('应该匹配 push 到 main', () => {
    const rule = { events: ['push'], branches: { include: ['main'] } };
    const payload = { event: 'push', branch: 'main' };
    expect(evaluateRule(rule, payload).matched).toBe(true);
  });
  it('应该拒绝禁用的规则', () => {
    const rule = { enabled: false, events: ['push'] };
    expect(evaluateRule(rule, { event: 'push' }).matched).toBe(false);
  });
});
```

### 并发控制测试

```typescript
describe('ConcurrencyManager', () => {
  it('cancelInProgress=true 应该取消旧运行', () => {
    manager.check({ cancelInProgress: true }, 'group', 'run-1');
    const result = manager.check({ cancelInProgress: true }, 'group', 'run-2');
    expect(result.cancelledPrevious).toBe(true);
  });
});
```

### 端到端 Webhook 测试

```typescript
describe('matchWebhook', () => {
  it('应该匹配 push 到 main 的 CI 规则', () => {
    const payload = { ref: 'refs/heads/main', after: 'abc123', pusher: { name: 'user' } };
    const results = matchWebhook(DEFAULT_RULES, 'push', payload);
    expect(results.some((r) => r.matched && r.rule?.id === 'ci-verification')).toBe(true);
  });
});
```

## 验证清单

1. **TypeScript 类型检查**：`npx tsc --noEmit`
2. **触发规则测试**：`npx vitest run src/__tests__/trigger-`
3. **全量测试**：`npx vitest run`
4. **安全检查**：确认无 shell 拼接、无 `as any`、输入有消毒

## 扩展指南

添加新触发规则：

1. 在 `types.ts` 中如需新事件类型，扩展 `TriggerEvent` 联合类型
2. 在 `rule-evaluator.ts` 的 `checkEventConditions` 中添加新的 case
3. 在 `default-rules.ts` 中定义规则配置
4. 在 `index.ts` 的 `normalizePayload` 中添加载荷解析
5. 编写对应测试用例
