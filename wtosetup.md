# Manticore Bot 具体设置步骤

## 1. 环境准备

### 1.1 检查 Node.js 版本

```bash
node --version
# 预期输出：v20.x.x 或更高

npm --version
# 预期输出：10.x.x 或更高
```

如果版本过低，使用 nvm 安装：

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 安装 Node.js 20
nvm install 20
nvm use 20
```

### 1.2 克隆仓库

```bash
git clone https://github.com/your-username/Mostima-Moment-Bot.git
cd Mostima-Moment-Bot
```

### 1.3 安装依赖

```bash
npm install
```

验证安装：

```bash
ls node_modules/.package-lock.json
# 预期：文件存在
```

---

## 2. GitHub App 创建

### 2.1 创建 GitHub App

1. 打开浏览器，访问：https://github.com/settings/apps/new
2. 填写以下信息：
   - **GitHub App name**: `Manticore Bot`
   - **Description**: `CI/CD 自动检查与部署反馈机器人`
   - **Homepage URL**: `https://github.com/your-username/Mostima-Moment-Bot`

### 2.2 配置 Webhook

1. 在 "Webhook" 部分：
   - **Webhook URL**: `https://your-domain.com/api/webhook/github`
     - 开发环境：使用 ngrok/cloudflared 隧道 URL
     - 生产环境：使用你的域名
   - **Webhook secret**: 输入一个随机字符串（例如：`my_secret_key_12345`）
     - **重要**：记住这个值，后续需要配置到环境变量

2. 点击 "Generate a new webhook secret" 可以自动生成

### 2.3 配置权限

在 "Permissions" 部分，设置以下权限：

**Repository permissions:**

- [x] Contents: Read（读取代码）
- [x] Pull requests: Read & Write（读写 PR）
- [x] Issues: Read & Write（读写 Issue）
- [x] Metadata: Read（读取元数据）

**Organization permissions:**

- [ ] 保持默认（无权限）

**User permissions:**

- [ ] 保持默认（无权限）

### 2.4 订阅事件

在 "Subscribe to events" 部分，选择：

- [x] Pull request（PR 创建/更新事件）
- [x] Issue comment（Issue 评论事件）
- [x] Workflow run（GitHub Actions 工作流事件）

### 2.5 安装范围

在 "Where can this GitHub App be installed?" 部分：

- 选择 "Only on this account"

### 2.6 创建 App

1. 点击 "Create GitHub App"
2. 记录 **App ID**（页面顶部显示的数字）
3. 点击 "Generate a private key"
4. 下载私钥文件（`.pem` 格式）
5. 将私钥文件保存到项目根目录，命名为 `private-key.pem`

### 2.7 安装 App 到仓库

1. 在 App 设置页面，点击左侧 "Install App"
2. 选择要安装的仓库
3. 点击 "Install"
4. 记录 **Installation ID**（URL 中的数字，例如：`https://github.com/settings/installations/12345678`）

---

## 3. 环境变量配置

### 3.1 复制模板

```bash
cp .env.example .env.local
```

### 3.2 编辑 .env.local

使用编辑器打开 `.env.local`，填写以下内容：

```env
# GitHub App 配置
GITHUB_APP_ID=123456                    # 替换为你的 App ID
GITHUB_PRIVATE_KEY_PATH=./private-key.pem
ENCRYPTION_KEY=my_secret_key_12345  # 替换为你的 Webhook secret

# 仓库配置
REPO_OWNER=your-username                # 替换为你的 GitHub 用户名
REPO_NAME=Mostima-Moment-Bot            # 替换为你的仓库名

# Webhook 密钥（用于签名验证）
ENCRYPTION_KEY=my_secret_key_12345      # 与 ENCRYPTION_KEY 一致

# 服务器配置
BOT_PORT=3001
WORKSPACE_DIR=./workspace

# Webhook 可达性
PUBLIC_URL=https://your-domain.com      # 替换为你的域名或隧道 URL

# 合作者列表（逗号分隔，用于手动重试鉴权）
COLLABORATORS=user1,user2               # 替换为你的合作者用户名
```

### 3.3 验证私钥文件

```bash
ls -la private-key.pem
# 预期输出：-rw-r--r-- 1 user group 1234 Jun 20 10:00 private-key.pem

head -1 private-key.pem
# 预期输出：-----BEGIN RSA PRIVATE KEY-----
```

---

## 4. 启动服务器

### 4.1 开发模式

```bash
npm run dev
```

预期输出：

```
Manticore Bot running on port 3001
```

### 4.2 验证服务器

打开新终端，执行：

```bash
curl http://localhost:3001/health
```

预期输出：

```json
{ "status": "ok", "service": "manticore-bot" }
```

### 4.3 停止服务器

在服务器终端按 `Ctrl + C`

---

## 5. Webhook 可达性配置

### 5.1 开发环境 - 使用 ngrok

**安装 ngrok：**

```bash
# macOS
brew install ngrok

# Linux
sudo snap install ngrok

# Windows
choco install ngrok
```

**启动隧道：**

```bash
ngrok http 3001
```

预期输出：

```
Forwarding  https://xxxx-xxx-xxx.ngrok.io -> http://localhost:3001
```

**记录公网 URL：**

```bash
# 复制 ngrok 输出的 https URL
# 例如：https://xxxx-xxx-xxx.ngrok.io
```

**更新 .env.local：**

```env
PUBLIC_URL=https://xxxx-xxx-xxx.ngrok.io
```

**更新 GitHub App Webhook URL：**

1. 访问 https://github.com/settings/apps/your-app-name
2. 点击 "Edit" Webhook
3. 更新 URL 为：`https://xxxx-xxx-xxx.ngrok.io/api/webhook/github`
4. 点击 "Update"

### 5.2 开发环境 - 使用 cloudflared

**安装 cloudflared：**

```bash
# macOS
brew install cloudflared

# Linux
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
```

**启动隧道：**

```bash
cloudflared tunnel --url http://localhost:3001
```

预期输出：

```
Your quick Tunnel has been created! Visit it at (it may take some time to be accessible):
https://random-words-here.trycloudflare.com
```

**记录公网 URL：**

```bash
# 复制输出的 https URL
# 例如：https://random-words-here.trycloudflare.com
```

**更新 .env.local：**

```env
PUBLIC_URL=https://random-words-here.trycloudflare.com
```

### 5.3 生产环境 - 使用 Nginx

**安装 Nginx：**

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx
```

**创建配置文件：**

```bash
sudo nano /etc/nginx/sites-available/manticore-bot
```

**写入以下内容：**

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;

    location /api/webhook/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    location / {
        root /path/to/your/Mostima-Moment-Bot/.next/static;
        try_files $uri $uri/ =404;
    }
}
```

**启用配置：**

```bash
sudo ln -s /etc/nginx/sites-available/manticore-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**配置 SSL 证书（使用 Let's Encrypt）：**

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 6. Docker 部署

### 6.1 安装 Docker

```bash
# macOS
brew install --cask docker

# Linux
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 6.2 配置环境变量

确保 `.env.local` 已配置，然后创建 Docker 环境文件：

```bash
cp .env.local docker/.env
```

### 6.3 构建镜像

```bash
cd docker
docker-compose build
```

预期输出：

```
Successfully built xxx
Successfully tagged manticore-bot:latest
```

### 6.4 启动服务

```bash
docker-compose up -d
```

预期输出：

```
Creating network "docker_default" with the default driver
Creating docker_manticore-bot_1 ... done
```

### 6.5 验证服务

```bash
# 查看容器状态
docker-compose ps

# 预期输出：
# NAME                    STATUS              PORTS
# docker_manticore-bot_1  Up                  0.0.0.0:3001->3001/tcp

# 查看日志
docker-compose logs -f manticore-bot

# 预期输出：
# Manticore Bot running on port 3001

# 测试健康检查
curl http://localhost:3001/health
```

### 6.6 常用 Docker 命令

```bash
# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看实时日志
docker-compose logs -f

# 进入容器
docker-compose exec manticore-bot sh
```

---

## 7. 验证测试

### 7.1 测试签名验证

**测试有效签名：**

```bash
PAYLOAD='{"action":"opened","pull_request":{"number":1}}'
SECRET="my_secret_key_12345"
SIGNATURE="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')"

curl -X POST http://localhost:3001/api/webhook/github \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -H "X-GitHub-Event: pull_request" \
  -d "$PAYLOAD"

# 预期输出：{"received":true}
```

**测试无效签名：**

```bash
curl -X POST http://localhost:3001/api/webhook/github \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=invalid_signature" \
  -H "X-GitHub-Event: pull_request" \
  -d '{"action":"opened"}'

# 预期输出：{"error":"Invalid signature"}
```

**测试无签名请求：**

```bash
curl -X POST http://localhost:3001/api/webhook/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -d '{"action":"opened"}'

# 预期输出：{"error":"Invalid signature"}
```

### 7.2 测试 CI 检查

创建一个测试 PR，验证：

1. 服务器日志显示：`Triggering CI checks for PR #X`
2. CI 检查步骤依次执行
3. PR 下方出现 Manticore Bot 评论

### 7.3 测试手动重试

在 PR 下发表评论：

```
/rebuild
```

或

```
/retry
```

验证：

1. 服务器日志显示：`Manual rebuild triggered for PR #X by username`
2. 重新执行 CI 检查

---

## 8. 故障排查

### 8.1 服务器无法启动

**检查端口占用：**

```bash
lsof -i :3001
# 如果有进程占用，杀死它
kill -9 <PID>
```

**检查环境变量：**

```bash
echo $GITHUB_APP_ID
echo $ENCRYPTION_KEY
# 如果为空，重新加载环境变量
source .env.local
```

**检查私钥文件：**

```bash
ls -la private-key.pem
# 如果不存在，重新下载
```

### 8.2 Webhook 未接收

**检查 GitHub App 配置：**

1. 访问 https://github.com/settings/apps/your-app-name
2. 确认 Webhook URL 正确
3. 确认 Webhook secret 与环境变量一致
4. 查看 "Recent deliveries" 是否有记录

**检查服务器日志：**

```bash
npm run dev
# 观察是否有请求到达
```

**检查网络连通性：**

```bash
# 如果使用 ngrok
curl https://xxxx-xxx-xxx.ngrok.io/health

# 如果使用 cloudflared
curl https://random-words-here.trycloudflare.com/health
```

### 8.3 CI 检查失败

**手动执行 CI 步骤：**

```bash
# 进入工作区目录
cd workspace

# 依次执行
npm ci
npm run lint
npx tsc --noEmit
npm run build

# 查看具体错误
```

**常见错误：**

1. `npm ci` 失败 → 检查 package.json 和 package-lock.json
2. `npm run lint` 失败 → 检查 ESLint 配置
3. `npx tsc --noEmit` 失败 → 检查 TypeScript 类型错误
4. `npm run build` 失败 → 检查 Next.js 配置

### 8.4 Docker 问题

**容器无法启动：**

```bash
docker-compose logs manticore-bot
# 查看错误信息
```

**端口冲突：**

```bash
# 修改 docker-compose.yml 中的端口映射
ports:
  - "3002:3001"  # 使用 3002 端口
```

---

## 9. 完成确认

- [ ] 服务器正常运行（`curl http://localhost:3001/health` 返回 200）
- [ ] Webhook 可达（ngrok/cloudflared/域名正常工作）
- [ ] 签名验证通过（有效签名返回 200，无效签名返回 401）
- [ ] CI 检查正常执行（PR 创建时触发检查）
- [ ] PR 报告正常生成（PR 下方出现评论）
- [ ] 手动重试正常工作（`/rebuild` 或 `/retry` 命令）
