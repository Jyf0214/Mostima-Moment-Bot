---
name: workflow-logs-page
description: 工作流日志页面：单组件双视图（仓库列表 + 详情） + bot 触发过滤 + isBotInitiated 字段
source: auto-skill
extracted_at: '2026-06-21T01:06:00.000Z'
---

# 工作流日志页面

## 架构

单组件双视图：`WorkflowLogsPage` 通过 `selectedRepo` state 切换列表/详情。

### 仓库列表视图

- 组件：`src/components/dashboard/WorkflowLogsPage.tsx`
- 无 `selectedRepo` 时显示
- API：`GET /api/ci/runs`（无 repo 参数）→ 返回有 bot 记录的仓库摘要
- 每个仓库卡片显示：名称、总运行数、最新状态、最新分支、事件类型
- 点击仓库 → 设置 `selectedRepo` → 切换到详情视图

### 详情视图

- 同一组件 `WorkflowLogsPage.tsx`，有 `selectedRepo` 时显示
- API：`GET /api/ci/runs?repo={repo}&botOnly=true` → 返回运行记录
- 支持状态/事件过滤、分页（每页 30 条）
- 每条记录显示：状态图标、事件类型、分支、PR、SHA、触发者、耗时、相对时间
- 返回按钮 → 清除 `selectedRepo` → 回到列表视图

### 仓库详情页日志卡片

- 文件：`src/pages/dashboard/repo.tsx`
- 运行日志区域显示总数 + "查看详情"链接跳转到 `/dashboard` 的 logs 导航
- 不再内联显示日志列表

## 数据模型

### CiRun 表（prisma/schema.prisma）

```prisma
model CiRun {
  id              Int       @id @default(autoincrement())
  repoFullName    String    @map("repo_full_name")
  event           String
  action          String?
  branch          String?
  commitSha       String?   @map("commit_sha")
  prNumber        Int?      @map("pr_number")
  status          String    @default("pending")
  conclusion      String?
  triggeredBy     String?   @map("triggered_by")
  ruleId          String?   @map("rule_id")
  checksRan       String[]  @default([]) @map("checks_ran")
  logs            String?
  isBotInitiated  Boolean   @default(false) @map("is_bot_initiated")
  startedAt       DateTime? @map("started_at")
  completedAt     DateTime? @map("completed_at")
  duration        Int?
  createdAt       DateTime  @default(now()) @map("created_at")

  @@index([repoFullName])
  @@index([createdAt])
  @@index([status])
  @@index([isBotInitiated])
  @@map("ci_runs")
}
```

## 什么记录到 CiRun / 什么不记录

### 只记录 bot 自身触发的 AI 工作流（isBotInitiated=true）

| 事件                     | event 类型     | triggeredBy | 触发方式                |
| ------------------------ | -------------- | ----------- | ----------------------- |
| Issue 被贴 auto-fix 标签 | issue_labeled  | bot         | `shouldTriggerIssueFix` |
| Issue 评论 @{slug} /fix  | issue_comment  | bot         | `shouldTriggerIssueFix` |
| PR 安全审计              | security_audit | bot         | `auditPR`               |

**注意：** issue_comment 日志的 `prNumber` 字段**不**存储 issue 编号（issue ≠ PR）。issue 编号只在 `logs` 文本字段中显示。

### 不记录（禁止存储 GitHub Actions 记录）

| 事件                            | 原因                               |
| ------------------------------- | ---------------------------------- |
| push                            | 用户仓库 CI，非 bot 工作流         |
| workflow_job                    | GitHub Actions 记录，非 bot 工作流 |
| PR CI 检查（handlePullRequest） | 用户触发的 CI，非 bot 工作流       |

## API 设计

### GET /api/ci/runs

| 参数         | 说明                          |
| ------------ | ----------------------------- |
| 无 repo      | 返回有 bot 触发记录的仓库摘要 |
| repo=xxx     | 返回指定仓库运行记录          |
| botOnly=true | 只返回 bot 触发的记录         |
| limit=50     | 分页大小（最大 200）          |
| offset=0     | 分页偏移                      |

### POST /api/ci/runs

内部调用，记录新的运行。

## 关键文件

- `src/lib/ci/run-logger.ts` — 记录/更新运行日志
- `src/pages/api/ci/runs.ts` — 查询 API（支持仓库列表模式 + 详情模式）
- `src/pages/api/webhook/github.ts` — Webhook 事件记录（只记录 bot 工作流）
- `src/components/dashboard/WorkflowLogsPage.tsx` — 单组件双视图（列表+详情）
- `src/pages/dashboard/repo.tsx` — 仓库详情页日志卡片

## 注意事项

- **不用动态路由**：删除了 `/dashboard/logs/[repo]` 页面，因为 `owner/repo` 中的 `/` 会与 Next.js 路由冲突
- 列表查询不返回 `logs` 字段，节省带宽
- 日志大小限制 50KB
- `isBotInitiated` 字段需要 `db push` 后才生效
- push/workflow_job/PR CI 事件的 CiRun 记录已永久移除
- issue_comment 事件不应将 issue 编号写入 `prNumber` 字段
