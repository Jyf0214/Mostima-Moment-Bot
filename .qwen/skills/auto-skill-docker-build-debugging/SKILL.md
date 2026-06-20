---
name: docker-build-debugging
description: Docker 构建失败诊断与修复：.dockerignore 过度排除、依赖放置错误、构建上下文不完整等常见问题
source: auto-skill
extracted_at: '2026-06-20T09:36:15.188Z'
---

# Docker 构建失败诊断与修复

## 概述

系统性诊断 Docker 构建失败，特别是 Next.js 项目的常见问题：`.dockerignore` 过度排除源码、依赖放置错误导致运行时缺失、构建上下文不完整等。

## 常见失败模式

### 模式 1：`.dockerignore` 过度排除

**症状：** `Module not found: Can't resolve '@/...'` — 所有 `@/` 路径别名都失败

**根因：** `.dockerignore` 排除了 `tsconfig.json`（包含路径别名定义）或其他构建必需文件

**诊断：**

```bash
# 检查 .dockerignore 内容
cat .dockerignore

# 检查关键文件是否在构建上下文中
docker run --rm -v $(pwd):/app -w /app node:20-alpine sh -c "ls -la tsconfig.json next.config.js postcss.config.mjs prisma.config.ts"
```

**修复原则 — `.dockerignore` 应只排除：**

```
# 安全排除
.git/
.env
.env.*
!.env.example
__tests__/
*.md
LICENSE
.vscode/
.idea/
.qwen/
.husky/
coverage/
docker-compose.yml
```

**绝对不能排除的文件：**

- `tsconfig.json` — 路径别名定义
- `next.config.js` — Next.js 配置
- `postcss.config.mjs` — Tailwind CSS 配置
- `prisma.config.ts` — Prisma 配置
- `prisma/schema.prisma` — 数据库 schema
- `src/` — 所有源码
- `package.json` / `package-lock.json`

### 模式 2：依赖放置错误

**症状 1：** 运行时 `command not found: prisma`

**根因：** `prisma` CLI 被放在 `devDependencies`，Dockerfile 的 `npm prune --omit=dev` 移除了它

**症状 2：** 构建时 `Module not found` 但本地正常

**根因：** 构建时需要的包（如 `@prisma/client`）被放在 `devDependencies`

**诊断：**

```bash
# 检查哪些包在运行时需要
grep -r "from '" src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v __tests__

# 检查 package.json 中 prisma 的位置
node -e "const p = require('./package.json'); console.log('deps:', Object.keys(p.dependencies || {}).filter(k => k.includes('prisma'))); console.log('devDeps:', Object.keys(p.devDependencies || {}).filter(k => k.includes('prisma')))"
```

**修复原则：**

- `prisma` CLI → `dependencies`（运行时 `prisma db push` 需要）
- `@prisma/client` → `dependencies`（运行时查询需要）
- `@types/*`、`eslint`、`vitest`、`typescript` → `devDependencies`

### 模式 3：Dockerfile 顺序错误

**症状：** 构建缓存失效，每次都要重新安装依赖

**正确顺序（利用 Docker 缓存）：**

```dockerfile
FROM node:20-alpine
WORKDIR /app

# 1. 先复制依赖文件（缓存层）
COPY package*.json ./
RUN npm ci

# 2. 再复制 schema 并生成客户端
COPY prisma/ ./prisma/
RUN npx prisma generate

# 3. 最后复制源码（变化最频繁）
COPY . .

# 4. 构建
RUN npm run build

# 5. 清理
RUN npm prune --omit=dev
```

## 诊断流程

### Step 1：获取失败日志

```bash
# GitHub Actions
gh run view <run-id> --log-failed

# 本地 Docker
docker build -f docker/Dockerfile . 2>&1 | tail -50
```

### Step 2：识别错误类型

| 错误模式                                  | 根因                      | 修复方向                       |
| ----------------------------------------- | ------------------------- | ------------------------------ |
| `Module not found: Can't resolve '@/...'` | tsconfig.json 被排除      | 检查 .dockerignore             |
| `command not found: prisma`               | prisma 在 devDependencies | 移到 dependencies              |
| `npm ERR! peer dep missing`               | 依赖版本冲突              | 检查 package.json              |
| `ENOENT: no such file or directory`       | 文件未复制到构建上下文    | 检查 COPY 指令和 .dockerignore |

### Step 3：验证修复

```bash
# 本地验证（如果有 Docker）
docker build -f docker/Dockerfile -t test-build .

# 检查构建上下文大小
du -sh . --exclude=.git
docker build --no-cache -f docker/Dockerfile . 2>&1 | head -5

# 推送后观察 GitHub Actions
gh run list --limit 1
gh run watch <run-id> --exit-status
```

## 验证清单

构建修复后，确认以下全部通过：

- [ ] `npx vitest run` — 所有测试通过
- [ ] `npx tsc --noEmit` — TypeScript 类型检查通过
- [ ] `npm run build` — 本地 Next.js 构建成功
- [ ] GitHub Actions 工作流成功（`gh run list` 显示 ✓）
- [ ] Docker 镜像可正常启动（`docker run` 测试）

## 修复提交模板

```
fix: 修复 Docker 构建失败

- 修复 .dockerignore 过度排除导致源码缺失的问题
- [具体依赖] 从 devDependencies 移回 dependencies（运行时需要）
- 移除不再使用的 [包名] 依赖
```

## 预防措施

1. **新建项目时**：.dockerignore 只排除明确不需要的文件，不使用白名单模式
2. **移动依赖前**：检查 Dockerfile 和 docker-compose.yml 是否依赖该包
3. **添加 .dockerignore 条目前**：确认该文件不影响 `npm run build`
4. **CI 失败时**：第一反应检查 .dockerignore 和 package.json 依赖位置
