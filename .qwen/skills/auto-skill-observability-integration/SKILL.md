---
name: observability-integration
description: Multi-layer observability/logging system integration pattern — Prisma schema + logger utility + API endpoint + event handler integration + UI card + i18n
source: auto-skill
extracted_at: '2026-06-20T22:49:36.691Z'
---

# 可观测性系统集成模式

在已有系统中添加运行日志/审计追踪/事件记录等可观测性能力时，需要跨越 6 个层级同步实施。核心原则是 **不阻塞主流程**（fire-and-forget）和 **分层职责清晰**。

## 实施步骤

### 1. Prisma Schema（数据层）

- 新增记录模型，字段覆盖：谁触发、什么事件、结果状态、时间戳、日志内容
- 添加组合索引（如 `repoFullName + createdAt`）支持高效查询
- 日志字段用 `String`，不做大小限制（由应用层截断）
- 必须有 `startedAt` / `completedAt` 支持耗时计算

```
关键字段模式：repo, event, action, branch, commitSha, prNumber, status, conclusion, triggeredBy, logs, startedAt, completedAt, duration
```

### 2. Logger 工具函数（服务层）

创建 `lib/ci/run-logger.ts` 或类似文件，提供：

- **recordCiRun**：创建记录，返回 `runId`。内部自动设置 `startedAt`。捕获异常不抛出（fire-and-forget）。
- **updateCiRun**：更新记录状态。当 status 变为终态（success/failure/cancelled）时自动设置 `completedAt`，并可选计算 `duration`。
- **日志大小限制**：对 logs 字段做 `slice(0, 50000)` 截断，防止超大载荷。

```typescript
// 典型 fire-and-forget 调用模式
const runId = await recordCiRun({ repo, event: 'pull_request', status: 'running', ... });
handlePR(payload).then(() => updateCiRun(runId, { status: 'success' }))
  .catch(err => updateCiRun(runId, { status: 'failure', logs: err.message }));
```

### 3. API 端点（接口层）

创建 `/api/ci/runs` 或类似路由：

- **GET**：查询列表，JWT 认证。列表接口 **不返回完整日志**（`logs: false`），节省带宽。支持 `repo`、`limit`、`offset` 分页。
- **POST**：创建记录，支持内部 API key 或 JWT 认证。输入验证（类型、长度限制）。status 枚举白名单校验。
- Prisma Client 类型在 db push 前可能不包含新模型，用类型断言绕过：

```typescript
const db = prisma as unknown as { ciRun: { findMany: ...; count: ...; create: ...; } };
```

### 4. 事件处理器集成（集成层）

在现有 webhook handler 中，为每个关键事件添加日志记录：

- **PR 事件**：`opened` / `synchronize` 时创建 running 记录，CI 完成后更新终态
- **Push 事件**：记录 push 信息（commit message 截断到 80 字符）
- **workflow_job 事件**：仅在 `conclusion` 为终态时记录
- **所有日志记录调用必须 fire-and-forget**（`.catch(() => {})`），绝不能阻塞 webhook 响应（200 返回）

```typescript
// webhook handler 中的集成模式
const runId = await recordCiRun({ ... });
handleEvent(payload).then(() => updateCiRun(runId, { status: 'success' }))
  .catch(err => { console.error(err); updateCiRun(runId, { status: 'failure', logs: err.message }); });
```

### 5. UI 展示卡片（前端层）

在详情页添加日志卡片组件：

- 使用项目 UI 框架的 Card 组件
- 列表展示最近 N 条记录（如 30 条）
- 每条显示：状态图标（圆点颜色）、事件类型、分支名、PR 编号、commit SHA（7位截断）、触发者、耗时、相对时间
- 空状态提示
- 刷新按钮
- 数据获取通过 `useEffect` + `fetch` 调用 GET API

### 6. i18n 国际化

在 `zh.json` 和 `en.json` 中添加对应翻译键：

- 功能标题（如 `runLogs`）
- 统计标签（如 `totalRuns`）
- 空状态提示（如 `noRuns`）

## 关键注意事项

1. **Fire-and-forget 是铁律**：所有日志记录失败绝不能影响主业务流程
2. **列表不含详情**：列表 API 不返回完整日志，详情可单独查询
3. **Prisma 类型断言**：新模型在 db push 前类型不存在，用 `as unknown as {...}` 绕过
4. **日志大小限制**：防止超大 payload 写入数据库
5. **终态自动补全**：completedAt 和 duration 在 status 变为终态时自动计算

---

## 扩展模式：两级日志浏览（仓库列表 → 独立详情页）

当日志按仓库分组时，采用两级浏览结构比单页平铺更清晰。

### API 扩展

在现有 GET `/api/ci/runs` 基础上，根据 `repo` 参数区分两种模式：

- **无 `repo` 参数** → 返回仓库列表摘要：从最近 N 条记录中按 `repoFullName` 分组，统计每个仓库的总运行数和最新运行状态，按最新时间倒序
- **有 `repo` 参数** → 返回该仓库的运行记录列表（原有行为）

```typescript
// 仓库摘要响应结构
{
  repos: ([{ repoFullName, totalRuns, latest: { status, createdAt, event, branch } }], total);
}
```

关键实现细节：

- 用 `findMany({ take: 500 })` 获取近期记录做分组，再用 `count()` 补全每个仓库的精确总数
- 分组逻辑在 JS 层完成（Prisma 不支持原生 GROUP BY），500 条足够覆盖活跃仓库
- `findMany` 返回类型需手动断言为具体类型（因 `db` 变量是 `unknown` 类型断言）

### 仓库列表页（组件）

作为仪表盘侧边栏的一个页面（如 `WorkflowLogsPage`）：

- 调用 `GET /api/ci/runs`（无 repo 参数）获取仓库列表
- 每个仓库一个可点击卡片，显示：仓库名、owner、总运行数、最新状态图标、最新分支、事件类型、相对时间
- 点击跳转到独立详情页：`/dashboard/logs/${encodeURIComponent(repoFullName)}`
- 空状态提示 + 刷新按钮

### 独立详情页（Pages Router 路由）

创建 `src/pages/dashboard/logs/[repo].tsx`：

- 从 URL 路径解析仓库名（`window.location.pathname.split('/').slice(3).join('/')`）
- 调用 `GET /api/ci/runs?repo=xxx&limit=30&offset=N` 获取运行记录
- 支持状态/事件过滤、分页
- 每条记录：状态图标（动画）、事件类型标签、分支、PR 编号、commit SHA、触发者、耗时、相对时间
- 返回按钮回到仪表盘
- 独立页面布局（不复用仪表盘侧边栏），全屏渐变背景 + 居中内容区

### 导航集成

- 侧边栏添加导航项（如 `logs` → `ScrollText` 图标）
- 仪表盘主页面通过 `activePage` 状态渲染仓库列表组件
- 详情页是独立路由，不经过仪表盘侧边栏

### 测试更新

当 API 行为从"无 repo 返回 400"变为"无 repo 返回仓库列表"时，对应测试需同步更新：

```typescript
// 旧行为
expect(res._getStatusCode()).toBe(400);
expect(data).toEqual({ error: 'Missing repo parameter' });

// 新行为
expect(res._getStatusCode()).toBe(200);
expect(data.repos).toBeDefined();
expect(Array.isArray(data.repos)).toBe(true);
```

---

## 扩展模式：Bot 触发的工作流日志过滤

当日志页面需要区分"用户触发的 CI"和"Bot 自身触发的 AI 工作流"时，使用 `isBotInitiated` 字段过滤。

### Schema 变更

在 CiRun 模型中添加布尔字段：

```prisma
isBotInitiated  Boolean   @default(false) @map("is_bot_initiated")
@@index([isBotInitiated])
```

### Logger 扩展

`recordCiRun` 接受 `isBotInitiated?: boolean` 参数，写入数据库。

### Webhook 标记规则

| 事件                            | isBotInitiated | triggeredBy | 说明                     |
| ------------------------------- | -------------- | ----------- | ------------------------ |
| Issue auto-fix（标签/评论触发） | `true`         | `bot`       | Bot 自身的 AI 修复工作流 |
| PR 安全审计                     | `true`         | `bot`       | Bot 自身的审计工作流     |
| PR CI 检查                      | `false`        | 用户 login  | 用户推送触发的 CI        |
| Push                            | `false`        | pusher name | 用户推送事件             |
| workflow_job                    | `false`        | —           | GitHub Actions 结果      |

### API 过滤

- 无 `repo` 参数时：只查询 `isBotInitiated: true` 的记录做分组
- 有 `repo` 参数时：支持 `botOnly=true` 查询参数过滤
- 统计总数也需加 `isBotInitiated: true` 条件

### UI 行为

- 工作流日志页面（仓库列表 + 详情页）默认只显示 Bot 工作流
- 仓库详情页（`/dashboard/repo`）可选择显示全部日志
