---
name: repo-config-toggle-flow
description: 仓库列表开关与详情配置页面：RepoConfig 模型、乐观更新开关、TODO 占位详情页
source: auto-skill
extracted_at: '2026-06-20T11:55:00.656Z'
---

# 仓库配置开关与详情流程

## 概述

为仪表盘仓库列表添加 CI/CD 启用开关和详情配置入口。每个仓库默认关闭，用户点击开关启用，点击仓库名进入详情配置页面。

## 数据库模型

```prisma
model RepoConfig {
  id            Int      @id @default(autoincrement())
  repoId        Int      @map("repo_id")
  repoFullName  String   @map("repo_full_name")
  repoOwner     String   @map("repo_owner")
  repoName      String   @map("repo_name")
  enabled       Boolean  @default(false)
  adminId       Int      @map("admin_id")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  admin Admin @relation(fields: [adminId], references: [id])

  @@unique([repoId, adminId])
  @@map("repo_configs")
}
```

Admin 模型关联：`repoConfigs RepoConfig[]`

## API 端点

### GET /api/github/repos — 仓库列表

返回每个仓库的 `enabled` 状态：

```typescript
// 构建 repoId -> enabled 映射
const configMap = new Map<number, boolean>();
for (const cfg of admin.repoConfigs) {
  configMap.set(cfg.repoId, cfg.enabled);
}

// 附加到仓库数据
repos.personal.map((r) => ({
  ...r,
  enabled: configMap.get(r.id) ?? false,
}));
```

### POST /api/github/repos/toggle — 切换开关

```typescript
// Body: { repoId, repoFullName, repoOwner, repoName }
// 响应: { enabled: boolean }

const existing = await prisma.repoConfig.findUnique({
  where: { repoId_adminId: { repoId, adminId: admin.id } },
});

if (existing) {
  // 切换
  const updated = await prisma.repoConfig.update({
    where: { id: existing.id },
    data: { enabled: !existing.enabled },
  });
  enabled = updated.enabled;
} else {
  // 首次启用
  await prisma.repoConfig.create({ data: { ... } });
  enabled = true;
}
```

## UI 模式

### 仓库开关组件

```tsx
// 乐观更新 + 失败回滚
const handleToggle = async (repo: Repo) => {
  const newState = !toggleStates[repo.id];
  setToggleStates((prev) => ({ ...prev, [repo.id]: newState })); // 乐观更新

  const res = await fetch('/api/github/repos/toggle', { method: 'POST', ... });
  if (!res.ok) {
    setToggleStates((prev) => ({ ...prev, [repo.id]: !newState })); // 回滚
  }
};
```

**开关样式**：使用 `role="switch"` + `aria-checked` 无障碍属性，紫色激活态 (`bg-purple-500`)，灰色关闭态 (`bg-white/20`)。

### 仓库详情页面

`/dashboard/repo?repoId=xxx&name=xxx` — 当前为 TODO 占位：

- CI/CD 配置（TODO）
- 触发规则（TODO）
- Webhook 设置（TODO）

## 文件结构

| 文件                                   | 功能                             |
| -------------------------------------- | -------------------------------- |
| `prisma/schema.prisma`                 | RepoConfig 模型                  |
| `src/pages/api/github/repos/toggle.ts` | 开关切换 API                     |
| `src/pages/api/github/repos.ts`        | 仓库列表 API（含 enabled 状态）  |
| `src/pages/dashboard.tsx`              | 仪表盘（RepoSection 组件含开关） |
| `src/pages/dashboard/repo.tsx`         | 仓库详情配置页面                 |

## 注意事项

1. **默认关闭**：RepoConfig `enabled` 默认为 `false`，用户必须主动点击开启
2. **乐观更新**：开关操作立即更新 UI，失败时回滚，用户体验流畅
3. **唯一约束**：`@@unique([repoId, adminId])` 防止重复配置
4. **降级处理**：无 RepoConfig 记录的仓库返回 `enabled: false`
5. **开关无障碍**：使用 `role="switch"` 和 `aria-checked` 属性
6. **详情页面**：TODO 占位使用虚线边框 (`border-dashed`) + 时钟图标提示"功能开发中"
