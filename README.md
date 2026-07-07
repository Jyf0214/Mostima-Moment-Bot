# Manticore Bot

纯确定性 CI/CD 自动检查与部署反馈机器人。

## 功能特性

- **Webhook 安全网关**：HMAC-SHA256 签名验证 + JWT 认证
- **事件驱动路由**：支持 pull_request、issue_comment、workflow_run 事件
- **Git 工作区协调**：自动分支切换、主分支同步、冲突检测
- **质量卡口校验**：npm ci → lint → tsc → build 四步检查
- **PR 报告生成**：Vercel 风格状态表格，自动在 PR 下留言
- **GitHub 一键登录**：OAuth 认证，首个用户自动绑定管理员
- **API 密钥登录**：支持通过 API 密钥免 OAuth 登录，便于测试
- **环境变量检查**：缺失必要配置时阻止应用访问

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js 单一服务                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │  - React 19 + Tailwind CSS v4                   │   │
│  │  - Next.js 16 Pages Router                      │   │
│  │  - API Routes (Webhook / Auth / Health)         │   │
│  │  - Proxy Middleware (认证检查)                   │   │
│  │  - Prisma ORM + PostgreSQL                      │   │
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
- PostgreSQL（用于数据持久化）
- GitHub App（用于 Webhook 和 OAuth 登录）
- Docker（可选，用于容器化部署）

---

## 1. 克隆仓库并安装依赖

```bash
git clone https://github.com/your-username/Mostima-Moment-Bot.git
cd Mostima-Moment-Bot
npm install
```

---

## 2. 创建 GitHub App

### 2.1 注册 GitHub App

1. 打开 https://github.com/settings/apps/new
2. 填写以下信息：

| 字段                | 值                                                      |
| ------------------- | ------------------------------------------------------- |
| **GitHub App name** | `Manticore Bot`（或自定义名称）                         |
| **Description**     | `CI/CD 自动检查与部署反馈机器人`                        |
| **Homepage URL**    | `https://your-domain.com`（或 `http://localhost:3000`） |

### 2.2 配置 Webhook

在 "Webhook" 部分：

| 字段               | 值                                           |
| ------------------ | -------------------------------------------- |
| **Webhook URL**    | `https://your-domain.com/api/webhook/github` |
| **Webhook secret** | 点击 "Generate a new webhook secret" 生成    |

> ⚠️ **重要**：记住这个 secret，后续需要配置到环境变量 `ENCRYPTION_KEY`。

### 2.3 配置权限

在 "Permissions" 部分，设置以下权限：

**Repository permissions:**

- [x] Contents: Read
- [x] Pull requests: Read & Write
- [x] Issues: Read & Write
- [x] Metadata: Read

**Subscribe to events:**

- [x] Pull request
- [x] Issue comment
- [x] Workflow run

### 2.4 安装范围

在 "Where can this GitHub App be installed?" 部分：

- 选择 "Only on this account"

### 2.5 创建并获取凭证

1. 点击 **"Create GitHub App"**
2. 记录 **App ID**（页面顶部显示的数字，例如 `123456`）
3. 点击 **"Generate a private key"**
4. 下载私钥文件（`.pem` 格式）
5. 将私钥文件保存到项目根目录，命名为 `private-key.pem`

```bash
# 将下载的私钥文件移动到项目根目录
mv ~/Downloads/your-app-name-*.pem ./private-key.pem
```

### 2.6 安装 App 到仓库

1. 在 App 设置页面，点击左侧 **"Install App"**
2. 选择要安装的仓库
3. 点击 **"Install"**
4. 记录 **Installation ID**（URL 中的数字）

---

## 3. 配置环境变量

### 3.1 复制模板

```bash
cp .env.example .env.local
```

### 3.2 编辑 `.env.local`

按照下方说明逐项填写，**网页端不支持自动生成这些值，必须通过命令或 GitHub 后台手动获取**。

#### 必要环境变量（缺失将导致应用无法访问）

```env
# ---- GitHub OAuth 配置 ----
# 在 GitHub → Settings → Developer settings → OAuth Apps 页面获取
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# ---- JWT 密钥 ----
# 用下方命令生成，用于用户认证会话签名
JWT_SECRET=your_jwt_secret

# ---- 加密密钥 ----
# 用下方命令生成，用于加密存储私钥和 Webhook Secret
ENCRYPTION_KEY=your_encryption_key

# ---- 数据库连接 ----
# 格式：postgresql://用户名:密码@主机:端口/数据库名
DATABASE_URL=postgresql://user:password@localhost:5432/manticore
```

#### 可选环境变量（CI/CD 功能需要）

```env
# ---- GitHub App 配置 ----
# 在 GitHub → Settings → Developer settings → GitHub Apps 页面获取
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY_PATH=./private-key.pem

# ---- 服务器配置 ----
PORT=3001

# ---- 应用公开地址（用于 OAuth 回调） ----
APP_URL=http://localhost:3001
```

### 3.3 生成密钥

网页端无法自动生成以下值，请使用终端命令：

```bash
# 生成 JWT_SECRET（32 字节随机十六进制字符串）
openssl rand -hex 32

# 生成 ENCRYPTION_KEY（32 字节随机十六进制字符串）
openssl rand -hex 32
```

将输出的值复制到 `.env.local` 对应字段中。

---

## 4. 配置 GitHub OAuth

### 4.1 创建 OAuth App

1. 打开 https://github.com/settings/developers
2. 点击 **"New OAuth App"**
3. 填写以下信息：

| 字段                           | 值                                          |
| ------------------------------ | ------------------------------------------- |
| **Application name**           | `Manticore Bot`                             |
| **Homepage URL**               | `https://your-domain.com`                   |
| **Authorization callback URL** | `https://your-domain.com/api/auth/callback` |

4. 点击 **"Register application"**
5. 记录 **Client ID**
6. 点击 **"Generate a new client secret"**
7. 记录 **Client Secret**（只显示一次）

### 4.2 更新环境变量

```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

---

## 5. 配置数据库

### 5.1 安装 PostgreSQL

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS
brew install postgresql@16
brew services start postgresql@16

# Docker
docker run -d --name postgres \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=manticore \
  -p 5432:5432 \
  postgres:16-alpine
```

### 5.2 创建数据库

```bash
# 连接 PostgreSQL
psql -U user -d postgres

# 创建数据库
CREATE DATABASE manticore;

# 退出
\q
```

### 5.3 运行数据库迁移

```bash
npx prisma generate
npx prisma db push
```

---

## 6. 启动应用

### 6.1 开发模式

```bash
npm run dev
```

应用将在 http://localhost:3000 启动。

### 6.2 首次访问

1. 打开 http://localhost:3000
2. 如果是全新应用，会自动跳转到 Setup 页面
3. 上传 GitHub App 私钥文件
4. 填写 App ID 和 Webhook Secret
5. 点击 **"使用 GitHub 登录"**
6. 第一个登录的用户将自动绑定为管理员

### 6.3 生产模式

```bash
npm run build
PORT=3001 npm start
```

---

## 7. API 密钥登录

除了 GitHub OAuth 登录外，系统还支持 API 密钥登录，便于测试和自动化。

### 7.1 生成 API 密钥

1. 登录 Dashboard
2. 点击侧边栏 "API Keys"
3. 输入密钥名称，点击 "创建"
4. **立即复制保存密钥**（只会显示一次）

### 7.2 使用 API 密钥登录

**浏览器直接访问（自动登录）：**

```
https://your-domain.com/api/auth/api-key-login?key=YOUR_API_KEY
```

**API 调用：**

```bash
POST /api/auth/api-key-login
Content-Type: application/json

{
  "apiKey": "YOUR_API_KEY"
}
```

---

## 8. Webhook 可达性配置

### 8.1 开发环境 - 使用 ngrok

```bash
# 安装 ngrok
npm install -g ngrok

# 启动隧道
ngrok http 3000

# 输出示例：
# Forwarding  https://xxxx-xxx.ngrok.io -> http://localhost:3000
```

将 `https://xxxx-xxx.ngrok.io/api/webhook/github` 设置为 GitHub App 的 Webhook URL。

### 8.2 开发环境 - 使用 cloudflared

```bash
# 安装 cloudflared
# macOS
brew install cloudflared

# Linux
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared

# 启动隧道
cloudflared tunnel --url http://localhost:3000
```

### 8.3 生产环境 - 使用 Nginx + Let's Encrypt

#### 安装 Nginx 和 Certbot

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install nginx
sudo yum install certbot python3-certbot-nginx
```

#### 创建 Nginx 配置

```bash
sudo nano /etc/nginx/sites-available/manticore-bot
```

写入以下内容：

```nginx
# HTTP → HTTPS 重定向
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

# HTTPS 反向代理
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com;

    # SSL 证书（Certbot 会自动配置）
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # 代理设置
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    # 静态文件缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        proxy_pass http://127.0.0.1:3000;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

#### 启用配置

```bash
sudo ln -s /etc/nginx/sites-available/manticore-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 获取 SSL 证书

```bash
sudo certbot --nginx -d your-domain.com
```

#### 自动续期

```bash
sudo certbot renew --dry-run
```

---

## 9. Docker 部署

### 9.1 构建并启动

```bash
cd docker
docker-compose up -d --build
```

### 9.2 查看日志

```bash
docker-compose logs -f manticore-bot
```

### 9.3 停止服务

```bash
docker-compose down
```

### 9.4 自定义端口

```bash
PORT=8080 docker-compose up -d
```

---

## 10. 验证部署

### 10.1 健康检查

```bash
curl http://localhost:3000/api/health
# 预期：{"status":"ok","service":"manticore-bot",...}
```

### 10.2 环境变量检查

```bash
curl http://localhost:3000/api/env-check
# 预期：{"isConfigured":true,...}
```

### 10.3 Webhook 签名验证

```bash
PAYLOAD='{"action":"opened","pull_request":{"number":1}}'
SECRET="your_webhook_secret"
SIGNATURE="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')"

curl -X POST http://localhost:3000/api/webhook/github \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -H "X-GitHub-Event: pull_request" \
  -d "$PAYLOAD"
# 预期：{"received":true}
```

### 10.4 测试无签名请求

```bash
curl -X POST http://localhost:3000/api/webhook/github \
  -H "Content-Type: application/json" \
  -d '{"action":"opened"}'
# 预期：{"error":"Invalid signature"}
```

---

## 11. 故障排查

### 环境变量缺失

**症状**：页面显示 "环境变量配置缺失"

**解决**：检查 `.env.local` 文件，确保以下变量已配置：

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `DATABASE_URL`

### 端口被占用

**症状**：`Error: listen EADDRINUSE: address already in use`

**解决**：

```bash
# 查找占用端口的进程
lsof -i :3000

# 杀死进程
kill -9 <PID>

# 或使用其他端口
PORT=3001 npm start
```

### 数据库连接失败

**症状**：`Can't reach database server`

**解决**：

```bash
# 检查 PostgreSQL 是否运行
sudo systemctl status postgresql

# 检查连接字符串
echo $DATABASE_URL

# 测试连接
psql $DATABASE_URL
```

### Webhook 未接收

**症状**：PR 创建后没有自动检查

**排查步骤**：

1. 检查 GitHub App 的 Webhook URL 是否正确
2. 检查 Webhook secret 是否与环境变量 `ENCRYPTION_KEY` 一致
3. 查看 GitHub App 的 "Recent deliveries" 页面
4. 检查服务器日志

### Docker 构建失败

**症状**：`docker build` 报错

**解决**：

```bash
# 清理 Docker 缓存
docker system prune -a

# 重新构建
docker-compose build --no-cache
```

---

## 12. 可用命令

```bash
# 开发
npm run dev                 # 启动开发服务器
npm run build               # 构建生产版本
npm start                   # 启动生产服务器

# 代码质量
npm run lint                # 运行 ESLint
npm run lint:fix            # 自动修复 ESLint 问题
npm run typecheck           # TypeScript 类型检查

# 测试
npm test                    # 运行所有测试
npm run test:watch          # 监听模式运行测试
npm run test:coverage       # 生成覆盖率报告

# 数据库
npm run prisma:generate     # 生成 Prisma Client
npm run prisma:migrate      # 运行数据库迁移
npm run prisma:studio       # 打开 Prisma Studio
```

## API 端点

### 认证相关

| 端点                      | 方法            | 说明                  |
| ------------------------- | --------------- | --------------------- |
| `/api/auth/login`         | GET             | GitHub OAuth 登录入口 |
| `/api/auth/callback`      | GET             | GitHub OAuth 回调     |
| `/api/auth/me`            | GET             | 获取当前用户信息      |
| `/api/auth/logout`        | POST            | 登出                  |
| `/api/auth/status`        | GET             | 检查应用状态          |
| `/api/auth/api-keys`      | GET/POST/DELETE | 管理 API 密钥         |
| `/api/auth/api-key-login` | GET/POST        | API 密钥登录          |

### Webhook

| 端点                  | 方法 | 说明                |
| --------------------- | ---- | ------------------- |
| `/api/webhook/github` | POST | GitHub Webhook 接收 |

### 系统

| 端点             | 方法 | 说明         |
| ---------------- | ---- | ------------ |
| `/api/health`    | GET  | 健康检查     |
| `/api/env-check` | GET  | 环境变量检查 |
| `/api/init`      | POST | 数据库初始化 |

### GitHub

| 端点                  | 方法 | 说明            |
| --------------------- | ---- | --------------- |
| `/api/github/install` | GET  | 安装 GitHub App |
| `/api/github/repos`   | GET  | 获取仓库列表    |
| `/api/github/test`    | GET  | 连通性测试      |

## 许可证

MIT License
