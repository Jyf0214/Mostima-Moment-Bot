# GitHub App 配置指南

本文档说明如何创建和配置 GitHub App，以及获取所需的环境变量。

---

## 一、创建 GitHub App

### 步骤

1. 登录 GitHub，进入 **Settings → Developer settings → GitHub Apps → New GitHub App**
2. 填写以下信息：
   - **GitHub App name**：`Manticore Bot`（或自定义名称）
   - **Homepage URL**：你的应用地址，如 `https://your-domain.com`
   - **Callback URL**：`https://your-domain.com/api/github/callback`（本地开发时为 `http://localhost:3001/api/github/callback`，安装回调必须配置此项）
   - **Webhook URL**：`https://your-domain.com/api/webhook/github`
   - **Webhook secret**：生成一个随机密钥并记录（见下方）
3. **Permissions** 权限设置：

   | 权限                         | 用途                        |
   | ---------------------------- | --------------------------- |
   | **Repository permissions**   |                             |
   | Contents: Read               | 读取仓库代码（CI 检查需要） |
   | Checks: Write                | 创建检查结果                |
   | Pull requests: Write         | 在 PR 上发布评论            |
   | Issues: Write                | 读取 issue comment 触发重试 |
   | Metadata: Read               | 读取仓库元信息              |
   | **Organization permissions** |                             |
   | Members: Read                | 读取组织成员信息（可选）    |

4. **Where can this GitHub App be installed?** 选择 `Only on this account`
5. 点击 **Create GitHub App**

### 创建后的关键信息

创建完成后，GitHub 会显示以下信息，需要记录并配置为环境变量：

---

## 二、环境变量获取说明

### 必要环境变量（用户登录）

| 变量                   | 说明                    | 获取方式                                                                             |
| ---------------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| `GITHUB_CLIENT_ID`     | OAuth App Client ID     | GitHub → Settings → Developer settings → **OAuth Apps** → 你的 OAuth App → Client ID |
| `GITHUB_CLIENT_SECRET` | OAuth App Client Secret | 同上 → Client Secrets → Generate a new client secret                                 |
| `JWT_SECRET`           | JWT 签名密钥            | 自行生成：`openssl rand -hex 32`                                                     |
| `ENCRYPTION_KEY`       | 数据加密密钥            | 自行生成：`openssl rand -hex 32`                                                     |
| `DATABASE_URL`         | PostgreSQL 连接串       | 你的数据库地址                                                                       |

### GitHub App 环境变量

| 变量                      | 说明               | 获取方式                                                                                                   |
| ------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `GITHUB_APP_ID`           | GitHub App 数字 ID | 创建 App 后在 App 设置页面顶部可见，格式为纯数字如 `123456`                                                |
| `GITHUB_PRIVATE_KEY_PATH` | 私钥文件路径       | 创建 App 时点击 **Generate a private key**，下载 `.pem` 文件，放到服务器上并填写路径如 `./private-key.pem` |
| `ENCRYPTION_KEY`          | Webhook 签名密钥   | 创建 App 时设置的 Webhook secret，用于验证 GitHub 发送的 Webhook 请求                                      |
| `REPO_OWNER`              | 目标仓库所有者     | 你的 GitHub 用户名或组织名，如 `Jyf0214`                                                                   |
| `REPO_NAME`               | 目标仓库名称       | 仓库名，如 `Mostima-Moment-Bot`                                                                            |

### 如何找到 App Slug

Bot slug 通过 App ID 调用 GitHub API 自动获取，无需手动配置。只需确保 `GITHUB_APP_ID` 正确即可。

---

## 三、配置 .env 文件

```bash
# 用户登录（OAuth App）
GITHUB_CLIENT_ID=Ov23li...
GITHUB_CLIENT_SECRET=...

# 安全密钥
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# 数据库
DATABASE_URL=postgresql://user:pass@localhost:5432/manticore

# GitHub App
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY_PATH=./private-key.pem
ENCRYPTION_KEY=$(openssl rand -base64 32)

# 目标仓库
REPO_OWNER=Jyf0214
REPO_NAME=Mostima-Moment-Bot
```

---

## 四、安装 GitHub App 到账户

配置好环境变量后：

1. 启动应用，登录控制面板
2. 点击 **"前往 GitHub 安装"** 按钮
3. 在 GitHub 页面选择要授权的账户或组织
4. 选择要授权的仓库（全部或部分）
5. 确认安装
6. 安装完成后自动跳转回控制面板，显示授权的仓库列表

---

## 五、配置 Webhook

安装 App 后，还需要为仓库启用 Webhook：

1. 进入仓库 Settings → Webhooks → Add webhook
2. **Payload URL**：`https://your-domain.com/api/webhook/github`
3. **Content type**：`application/json`
4. **Secret**：与 `.env` 中的 `ENCRYPTION_KEY` 一致
5. **Events**：选择以下事件
   - Pull requests
   - Issue comments
   - Workflow runs

---

## 六、常见问题

### 安装按钮点击后跳转失败

检查 `GITHUB_APP_ID` 是否正确配置。Bot slug 通过 API 自动获取。

### 仓库列表为空

确保 App 安装时选择了要授权的仓库。可在 GitHub → Settings → Installations 查看已安装的 App。

### Webhook 收不到事件

检查：

1. Webhook URL 是否可从外网访问
2. Webhook Secret 是否与环境变量一致
3. 事件类型是否正确选择
