# Manticore Bot

纯确定性 CI/CD 自动检查与部署反馈机器人，作为低配 Vercel 机器人。

## 功能特性

- **Webhook 安全网关**：HMAC-SHA256 签名验证 + JWT 认证
- **事件驱动路由**：支持 pull_request、issue_comment、workflow_run 事件
- **Git 工作区协调**：自动分支切换、主分支同步、冲突检测
- **质量卡口校验**：npm ci → lint → tsc → build 四步检查
- **PR 报告生成**：Vercel 风格状态表格，自动在 PR 下留言

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel 部署                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Mostima-Moment-Bot 前端                        │   │
│  │  - Mantine v7 + Chart.js                        │   │
│  │  - Next.js 14 Pages Router                      │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                 独立 Docker 服务                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Manticore Bot (Express)                        │   │
│  │  - 端口: 3001                                   │   │
│  │  - Webhook: POST /api/webhook/github            │   │
│  │  - 健康检查: GET /health                        │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ Webhook
                          │
┌─────────────────────────────────────────────────────────┐
│                    GitHub                               │
└─────────────────────────────────────────────────────────┘
```

## 快速开始

### 前置要求

- Node.js 20+
- npm 10+
- Docker（可选，用于容器化部署）
- GitHub App（用于 Webhook 和 API 访问）

### 1. 克隆仓库

```bash
git clone https://github.com/your-username/Mostima-Moment-Bot.git
cd Mostima-Moment-Bot
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制环境变量模板并填写配置：

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填写以下配置：

```env
# GitHub App 配置
GITHUB_APP_ID=your_app_id
GITHUB_PRIVATE_KEY_PATH=./private-key.pem
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# 仓库配置
REPO_OWNER=your_username
REPO_NAME=your_repo

# Webhook 密钥（用于签名验证）
WEBHOOK_SECRET=your_webhook_secret

# 服务器配置
BOT_PORT=3001
WORKSPACE_DIR=./workspace

# Webhook 可达性（GitHub Webhook URL）
PUBLIC_URL=https://your-domain.com

# 合作者列表（逗号分隔，用于手动重试鉴权）
COLLABORATORS=user1,user2
```

### 4. 下载 GitHub App 私钥

从 GitHub App 设置页面下载私钥文件，保存为 `private-key.pem`：

```bash
# 将私钥文件保存到项目根目录
cp /path/to/your-private-key.pem ./private-key.pem
```

### 5. 启动服务器

**开发模式：**

```bash
npm run server:dev
```

**生产模式：**

```bash
npm run server:build
npm run server:start
```

### 6. 验证服务器

```bash
# 健康检查
curl http://localhost:3001/health

# 预期响应
{"status":"ok","service":"manticore-bot"}
```

## GitHub App 配置

### 创建 GitHub App

1. 访问 https://github.com/settings/apps/new
2. 填写 App 名称和描述
3. 配置 Webhook URL：`https://your-domain.com/api/webhook/github`
4. 配置 Webhook secret：与环境变量 `WEBHOOK_SECRET` 一致
5. 设置权限：
   - Repository permissions:
     - Contents: Read
     - Pull requests: Read & Write
     - Issues: Read & Write
   - Subscribe to events:
     - Pull request
     - Issue comment
     - Workflow run
6. 生成并下载私钥文件

### 安装 GitHub App

1. 在 App 设置页面点击 "Install App"
2. 选择要安装的仓库
3. 记录 Installation ID（用于后续配置）

## Webhook 可达性

### 开发环境

使用隧道工具暴露本地端口：

**ngrok：**

```bash
ngrok http 3001
```

**cloudflared：**

```bash
cloudflared tunnel --url http://localhost:3001
```

### 生产环境

使用反向代理（Nginx/Caddy）提供 HTTPS：

**Nginx 示例：**

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /api/webhook/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Docker 部署

### 构建镜像

```bash
cd docker
docker-compose build
```

### 启动服务

```bash
docker-compose up -d
```

### 查看日志

```bash
docker-compose logs -f manticore-bot
```

### 停止服务

```bash
docker-compose down
```

## 事件处理

### pull_request 事件

当 PR 被创建或更新时，自动执行：

1. 切换到 PR 分支
2. 同步主分支（检测冲突）
3. 执行 CI 检查：
   - `npm ci`（依赖安装）
   - `npm run lint`（代码规范）
   - `npx tsc --noEmit`（类型检查）
   - `npm run build`（构建）
4. 生成 Vercel 风格报告
5. 在 PR 下留言

### issue_comment 事件

支持手动重试命令（仅合作者可用）：

- `/rebuild` - 重新执行 CI 检查
- `/retry` - 重新执行 CI 检查

### workflow_run 事件

记录外部 GitHub Actions 工作流结果。

## 验证清单

### 安全网关验证

```bash
# 测试签名验证
PAYLOAD='{"action":"opened"}'
SIGNATURE="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "your_webhook_secret" | awk '{print $2}')"

curl -X POST http://localhost:3001/api/webhook/github \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -d "$PAYLOAD"

# 预期：200 OK
```

```bash
# 测试无签名请求
curl -X POST http://localhost:3001/api/webhook/github \
  -H "Content-Type: application/json" \
  -d '{"action":"opened"}'

# 预期：401 Unauthorized
```

### CI 检查验证

```bash
# 测试完整 CI 流程
npm ci
npm run lint
npx tsc --noEmit
npm run build

# 预期：所有步骤退出码为 0
```

## 项目结构

```
Mostima-Moment-Bot/
├── src/
│   ├── server.ts                    # Express 服务器入口
│   ├── routes/
│   │   └── webhook.ts               # Webhook 路由
│   ├── lib/
│   │   ├── github/
│   │   │   ├── webhook.ts           # 签名验证
│   │   │   ├── auth.ts              # JWT 认证
│   │   │   └── api.ts               # GitHub API 封装
│   │   ├── ci/
│   │   │   ├── runner.ts            # CI 流程执行器
│   │   │   ├── checks.ts            # 质量卡口校验
│   │   │   └── reporter.ts          # PR 报告生成
│   │   └── git/
│   │       └── workspace.ts         # Git 工作区协调
│   ├── types/
│   │   └── express.d.ts             # Express 类型扩展
│   └── pages/                       # Next.js 前端（Vercel 部署）
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── .env.example                     # 环境变量模板
├── tsconfig.json                    # Next.js TypeScript 配置
├── tsconfig.server.json             # 服务器 TypeScript 配置
└── package.json
```

## 可用命令

```bash
# 开发
npm run server:dev          # 启动服务器开发模式（热重载）
npm run dev                 # 启动 Next.js 开发服务器

# 构建
npm run server:build        # 编译服务器 TypeScript
npm run build               # 构建 Next.js 前端

# 生产
npm run server:start        # 启动生产服务器
npm start                   # 启动 Next.js 生产服务器

# 代码质量
npm run lint                # 运行 ESLint
```

## 故障排查

### 服务器无法启动

```bash
# 检查端口占用
lsof -i :3001

# 检查环境变量
echo $GITHUB_APP_ID
echo $WEBHOOK_SECRET

# 检查私钥文件
ls -la private-key.pem
```

### Webhook 未接收

```bash
# 检查 GitHub App 配置
# 1. 确认 Webhook URL 正确
# 2. 确认 Webhook secret 与环境变量一致
# 3. 检查服务器日志

# 查看服务器日志
npm run server:dev
```

### CI 检查失败

```bash
# 手动执行 CI 步骤
npm ci
npm run lint
npx tsc --noEmit
npm run build

# 查看具体错误信息
```

## 后续迭代

- [ ] 阶段 7：数据持久化（PostgreSQL）
- [ ] 阶段 8：前端控制面板（Chart.js 图表）

## 许可证

MIT License
