---
name: bot-only-workflow-logs
description: 工作流日志仅记录 bot 自身触发的 AI 工作流，不记录用户仓库的 GitHub Actions 记录
source: auto-skill
extracted_at: '2026-06-21T00:36:36.634Z'
---

# Bot Only Workflow Logs

## 适用场景

机器人需要记录自己的 AI 工作流日志（如 Issue 自动修复、安全审计），但不应存储用户仓库的 GitHub Actions 记录。

## 核心原则

1. **isBotInitiated 字段**：CiRun 模型添加 `isBotInitiated Boolean @default(false)`，标记是否为 bot 自身触发
2. **只记录 bot 事件**：push/workflow_job/PR CI 检查不记录到 CiRun
3. **只记录 bot AI 工作流**：issue_labeled（auto-fix 标签）、issue_comment（@{slug} /fix）、security_audit
4. **触发者标记**：bot 触发的事件 `triggeredBy: 'bot'`

## 实现步骤

### 1. Schema 添加 isBotInitiated

```prisma
model CiRun {
  isBotInitiated  Boolean   @default(false) @map("is_bot_initiated")
  @@index([isBotInitiated])
}
```

### 2. run-logger 支持 isBotInitiated 参数

```typescript
export async function recordCiRun(params: {
  // ... 其他参数
  isBotInitiated?: boolean;
}): Promise<number | null> {
  // data 中添加
  isBotInitiated: params.isBotInitiated || false,
}
```

### 3. Webhook 处理器标记 bot 触发的事件

```typescript
// Issue auto-fix → bot 触发
recordCiRun({
  isBotInitiated: true,
  triggeredBy: 'bot',
  event: 'issue_labeled', // 或 'issue_comment'
});

// PR 安全审计 → bot 触发
recordCiRun({
  isBotInitiated: true,
  triggeredBy: 'bot',
  event: 'security_audit',
});

// push/workflow_job → 不记录 CiRun（只保留 console.log）
// PR CI 检查 → 不记录 CiRun（只保留 handlePullRequest 调用）
```

### 4. API 支持 botOnly 过滤

```typescript
// GET /api/ci/runs?botOnly=true
const where = { repoFullName: repo };
if (botOnly) where.isBotInitiated = true;

// 无 repo 参数时，只返回有 bot 记录的仓库
const recentRuns = await db.ciRun.findMany({
  where: { isBotInitiated: true },
  // ...
});
```

### 5. 前端默认 botOnly

```typescript
// 仓库详情页和日志详情页默认只显示 bot 工作流
const params = new URLSearchParams({
  repo: repoName,
  botOnly: 'true',
});
```

## 页面结构

```
仪表盘 → 工作流日志（仓库列表）
  ├── 每个仓库卡片：名称、总运行数、最新状态
  └── 点击 → /dashboard/logs/[repo]（独立详情页）
      ├── 状态/事件过滤
      ├── 分页
      └── 显示 bot 触发的工作流记录
```

## 仓库详情页

运行日志卡片改为跳转链接，不显示内联列表：

```tsx
<a href={`/dashboard/logs/${encodeURIComponent(repoName)}`}>查看详情</a>
```

## 注意事项

- 不要将 `isBotInitiated` 与 `triggeredBy` 混淆：前者是布尔标记，后者是触发者标识
- 测试中需要同时验证 bot 触发和非 bot 触发的行为
- 数据库迁移需要 `prisma db push`
