---
name: workflow-logs-page
description: 工作流日志页面：仓库列表 + 独立详情页 + bot 触发过滤 + isBotInitiated 字段
source: auto-skill
extracted_at: '2026-06-21T00:48:12.475Z'
---

# 工作流日志页面

## 架构

两层结构：仓库列表页 → 点击仓库 → 独立日志详情页。

### 仓库列表页

- 组件：`src/components/dashboard/WorkflowLogsPage.tsx`
- 路由：仪表盘侧边栏 `logs` 导航项
- API：`GET /api/ci/runs`（无 repo 参数）→ 返回有 bot 记录的仓库摘要
- 每个仓库卡片显示：名称、总运行数、最新状态、最新分支、事件类型
- 点击跳转到 `/dashboard/logs/{repo}`

### 日志详情页

- 文件：`src/pages/dashboard/logs/[repo].tsx`
- 路由：`/dashboard/logs/{repo}`（动态路由）
- API：`GET /api/ci/runs?repo={repo}&botOnly=true` → 返回运行记录
- 支持状态/事件过滤、分页（每页 30 条）
- 每条记录显示：状态图标、事件类型、分支、PR、SHA、触发者、耗时、相对时间
- 返回按钮回到仪表盘

### 仓库详情页日志卡片

- 文件：`src/pages/dashboard/repo.tsx`
- 运行日志区域显示总数 + "查看详情"链接跳转到 `/dashboard/logs/{repo}`
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
- `src/components/dashboard/WorkflowLogsPage.tsx` — 仓库列表页
- `src/pages/dashboard/logs/[repo].tsx` — 日志详情页
- `src/pages/dashboard/repo.tsx` — 仓库详情页日志卡片

## 注意事项

- 详情页使用动态路由 `[repo]`，需要 `decodeURIComponent` 处理仓库名中的 `/`
- 列表查询不返回 `logs` 字段，节省带宽
- 日志大小限制 50KB
- `isBotInitiated` 字段需要 `db push` 后才生效
- push/workflow_job/PR CI 事件的 CiRun 记录已永久移除
