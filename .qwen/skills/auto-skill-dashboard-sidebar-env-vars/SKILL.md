---
name: dashboard-sidebar-env-vars
description: 仪表盘侧边栏布局 + 环境变量管理页面 + 工作流日志页面：可折叠导航、全屏高度自适应、分组展示、搜索过滤、状态标识、获取教程
source: auto-skill
extracted_at: '2026-06-20T23:02:18.570Z'
---

# 仪表盘侧边栏 + 环境变量管理页面

## 概述

为仪表盘添加可折叠侧边栏导航和环境变量管理页面，支持分组展示、搜索过滤、配置状态标识和用途说明。

## 架构设计

### 页面结构

```
┌──────────┬────────────────────────────────┐
│ Sidebar  │  Main Content                  │
│          │  ├─ Header (avatar + title)    │
│ ├ Logo   │  └─ Page Content              │
│ ├ Nav    │     ├─ OverviewPage            │
│ │ ├ 概览 │     ├─ ReposPage               │
│ │ ├ 仓库 │     ├─ WorkflowLogsPage         │
│ │ ├ 日志 │     ├─ EnvVarsPage             │
│ │ ├ 环境 │     └─ SettingsPage            │
│ │ └ 设置 │                                │
│ ├ 收起   │                                │
│ └ 用户   │                                │
└──────────┴────────────────────────────────┘
```

### 组件文件

| 文件                                            | 功能                       |
| ----------------------------------------------- | -------------------------- |
| `src/components/dashboard/Sidebar.tsx`          | 可折叠侧边栏，5 个导航项   |
| `src/components/dashboard/EnvVarsPage.tsx`      | 环境变量管理页面           |
| `src/components/dashboard/WorkflowLogsPage.tsx` | 工作流日志页面             |
| `src/pages/api/env-status.ts`                   | 返回变量配置状态和用途     |
| `src/pages/dashboard.tsx`                       | 仪表盘主页面（侧边栏布局） |

### 数据流

```
EnvVarsPage → GET /api/env-status → jwt.verify(auth_token)
→ 遍历 ENV_VARS 数组 → process.env[key] 检查配置
→ 按 category 分组 → i18n 翻译 → 返回 JSON
```

## 实现要点

### 1. 侧边栏组件 (Sidebar.tsx)

```tsx
// 核心 props
interface SidebarProps {
  activePage: SidebarPage; // 'overview' | 'repos' | 'logs' | 'env' | 'settings'
  onNavigate: (page: SidebarPage) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  userLogin: string;
  onLogout: () => void;
}

// 导航项定义（含 tooltip）
const NAV_ITEMS = [
  {
    id: 'overview',
    icon: LayoutDashboard,
    labelKey: 'sidebar.overview',
    tooltip: 'sidebar.overview',
  },
  { id: 'repos', icon: Plug, labelKey: 'sidebar.repos', tooltip: 'sidebar.repos' },
  { id: 'logs', icon: ScrollText, labelKey: 'sidebar.logs', tooltip: 'sidebar.logs' },
  { id: 'env', icon: Shield, labelKey: 'sidebar.envVars', tooltip: 'sidebar.envVars' },
  { id: 'settings', icon: Settings, labelKey: 'sidebar.settings', tooltip: 'sidebar.settings' },
];
```

**要点：**

- 使用 `cn()` 工具函数合并类名
- **高度自适应**：侧边栏使用 `h-screen` 固定全屏高度，不依赖父容器
- **折叠模式**：`w-16`，导航项 `justify-center` 居中，按钮添加 `title` tooltip
- **展开模式**：`w-56`，导航项左对齐带文字
- 父容器使用 `h-screen` + `overflow-hidden` 防止溢出
- 主内容区域 `overflow-y-auto` 独立滚动
- 底部区域包含折叠按钮和用户信息+登出

**布局结构：**

```
<div className="h-screen flex overflow-hidden">   ← 父容器
  <Sidebar className="h-screen shrink-0">          ← 侧边栏固定全屏高度
    <Logo />                                        ← shrink-0
    <Nav className="flex-1 min-h-0 overflow-y-auto"> ← 弹性填充，可滚动
    <Bottom className="shrink-0">                   ← 底部固定
  </Sidebar>
  <div className="flex-1 overflow-y-auto">          ← 主内容独立滚动
```

### 2. 环境变量页面 (EnvVarsPage.tsx)

```tsx
// 数据结构
interface EnvVarDetail {
  key: string;
  category: string;
  required: boolean;
  configured: boolean;
  description: string;
  usage: string; // 实际用途说明
  hint: string; // 获取教程（可展开）
}

interface EnvGroup {
  name: string;
  description: string;
  vars: EnvVarDetail[];
}
```

**功能：**

- 顶部统计卡片（总数/已配置/未配置）
- 搜索框（按变量名、描述、用途过滤）
- 分组展示（GitHub OAuth / 安全 / 数据库 / GitHub App / CI/CD / 应用）
- 每个变量显示：名称、必要/可选标签、配置状态、描述、用途
- **可展开教程**：每个变量底部有「📖 获取方式」按钮，点击展开/收起详细步骤

**教程组件 (EnvVarCard)：**

```tsx
function EnvVarCard({ variable, expanded, onToggle }) {
  return (
    <ProCard>
      {/* 变量信息 */}
      <div>名称 + 标签 + 描述 + 用途 + 状态</div>
      {/* 教程按钮 */}
      <button onClick={onToggle}>
        <BookOpen /> 获取方式 <ChevronDown /> ← 展开/收起
      </button>
      {/* 展开的教程内容 */}
      {expanded && <pre>{hint}</pre>} ← 等宽字体，保持格式
    </ProCard>
  );
}
```

### 3. API 端点 (env-status.ts)

```tsx
// 环境变量定义
const ENV_VARS: EnvVarDef[] = [
  {
    key: 'GITHUB_CLIENT_ID',
    categoryKey: 'envCategory.oauth',
    required: true,
    descriptionKey: 'envVarDescriptions.githubClientId',
    usageKey: 'envUsage.githubClientId',
    hintKey: 'envVarHints.githubClientId', // 获取教程
  },
  // ... 14 个变量，每个都有 hintKey
];

// 响应格式
{
  groups: [
    {
      name: 'GitHub OAuth', // i18n 翻译
      description: '...', // i18n 翻译
      vars: [
        {
          key: 'GITHUB_CLIENT_ID',
          category: 'GitHub OAuth',
          required: true,
          configured: true, // process.env[key] 检查
          description: '...', // i18n 翻译
          usage: '...', // i18n 翻译 - 实际用途
          hint: '步骤：\n1. 打开...', // i18n 翻译 - 获取教程
        },
      ],
    },
  ];
}
```

**要点：**

- 需要 JWT 身份验证（从 auth_token cookie）
- 所有文本通过 i18n 翻译（不硬编码中文）
- `configured` 通过 `!!process.env[key]` 动态检查

### 4. 仪表盘主页面 (dashboard.tsx)

```tsx
// 页面状态
const [activePage, setActivePage] = useState<SidebarPage>('overview');
const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

// 布局
<div className="h-screen flex overflow-hidden">
  <Sidebar ... />
  <div className="flex-1 overflow-y-auto">
    {/* Header + Page Content */}
  </div>
</div>
```

**子页面组件：**

- `OverviewPage` — 统计卡片 + 快捷操作
- `ReposPage` — 仓库列表（复用之前逻辑）
- `EnvVarsPage` — 环境变量管理
- `SettingsPage` — 占位

## i18n 翻译键

```json
{
  "sidebar": {
    "overview": "概览",
    "repos": "仓库",
    "envVars": "环境变量",
    "settings": "设置",
    "collapse": "收起"
  },
  "envPage": {
    "title": "环境变量配置",
    "subtitle": "查看项目所有环境变量的配置状态和用途说明",
    "totalVars": "总变量数",
    "configured": "已配置",
    "missing": "未配置",
    "required": "必要",
    "optional": "可选",
    "search": "搜索变量名或用途...",
    "howToGet": "获取方式"
  },
  "envCategory": {
    "oauth": "GitHub OAuth",
    "oauthDesc": "用户登录认证所需的配置",
    "security": "安全",
    "securityDesc": "JWT 签名和数据加密所需的密钥",
    "database": "数据库",
    "databaseDesc": "PostgreSQL 数据库连接配置",
    "githubApp": "GitHub App",
    "githubAppDesc": "GitHub App 安装和 API 调用配置",
    "cicd": "CI/CD",
    "cicdDesc": "CI/CD 自动化流水线的可选配置",
    "app": "应用",
    "appDesc": "应用程序运行时的可选配置"
  },
  "envUsage": {
    "githubClientId": "用户点击「登录 GitHub」时，重定向到授权页面...",
    "...": "..."
  },
  "envVarHints": {
    "githubClientId": "步骤：\n1. 打开 https://github.com/settings/developers\n2. 点击「New OAuth App」\n3. 填写...",
    "githubAppId": "步骤：\n1. 打开 https://github.com/settings/apps\n2. 点击你创建的 App 名称\n3. ...",
    "...": "每个变量都有详细的获取步骤教程"
  }
}
```

## 环境变量清单（14 个）

| 分组         | 变量                      | 必要 | 用途                        |
| ------------ | ------------------------- | ---- | --------------------------- |
| GitHub OAuth | `GITHUB_CLIENT_ID`        | ✅   | 用户登录认证                |
| GitHub OAuth | `GITHUB_CLIENT_SECRET`    | ✅   | 交换访问令牌                |
| 安全         | `JWT_SECRET`              | ✅   | JWT 签名                    |
| 安全         | `ENCRYPTION_KEY`          | ✅   | 数据加密 + Webhook 签名验证 |
| 数据库       | `DATABASE_URL`            | ✅   | PostgreSQL 连接             |
| GitHub App   | `GITHUB_APP_ID`           | ❌   | App JWT 认证                |
| GitHub App   | `GITHUB_APP_SLUG`         | ❌   | 安装链接生成                |
| GitHub App   | `GITHUB_PRIVATE_KEY_PATH` | ❌   | 私钥文件路径                |
| 应用         | `APP_URL`                 | ❌   | 应用公开地址                |

## 注意事项

1. **i18n 合规**：API 返回的所有文本必须通过 `i18n.t()` 翻译，不能硬编码中文
2. **JSON 语法**：中文引号 `「」` 替代 `""`，避免 JSON 解析错误
3. **身份验证**：`/api/env-status` 需要 JWT 验证（不在 publicPaths 中）
4. **搜索过滤**：前端过滤，支持变量名、描述、用途三个字段
5. **状态检查**：`!!process.env[key]` 动态检查，不缓存
6. **侧边栏高度**：必须使用 `h-screen` 而非 `h-full`，父容器使用 `h-screen` + `overflow-hidden`，默认状态为收起 (`useState(true)`)
7. **折叠模式**：导航项使用 `justify-center` 居中，添加 `title` tooltip
8. **教程展示**：使用 `<pre>` + `whitespace-pre-wrap` 保持格式，`font-mono` 等宽字体
9. **14 个变量全部有教程**：每个 `envVarHints.*` 键必须有对应的中英文翻译
