---
name: deploy-debug-fix
description: 部署后日志驱动的迭代调试修复模式：从生产日志定位问题 → 代码级修复 → 提交推送 → 重新部署验证
source: auto-skill
extracted_at: '2026-06-20T22:28:39.213Z'
---

# 部署后调试修复模式

## 概述

用户部署应用后，从生产环境日志中发现问题，通过迭代「分析日志 → 定位根因 → 代码修复 → 提交推送 → 重新部署」循环逐步修复。与预部署审计不同，此模式的核心是**日志驱动**和**快速迭代**。

## 工作流程

### 阶段 1：接收日志分析

用户提供生产日志（通常通过 HuggingFace Space 日志或 Docker 日志），需要：

1. **提取关键错误信息**：忽略正常启动日志，聚焦 error/warning/异常
2. **关联代码位置**：从错误消息中的文件名和行号定位源码
3. **判断根因**：是配置问题、代码 bug、还是环境差异

### 阶段 2：逐层排查

按错误传播链从外到内排查：

```
用户看到的现象（如"安装后检测不到"）
  → 中间层错误（如 webhook 收到但未处理）
    → 根因（如 switch-case 缺少事件分支）
```

### 阶段 3：修复 + 即时验证

每次修复后必须：

1. TypeScript 类型检查：`npx tsc --noEmit`
2. 相关测试运行：`npx vitest run src/__tests__/xxx.test.ts`
3. 全量测试：`npx vitest run`（确保无回归）
4. 提交推送（不需要询问用户确认）

### 阶段 4：等待重新部署后验证

推送后告知用户等待重建，并说明需要验证什么。

## 本次对话中的实际案例

### 案例 1：Invalid state parameter

**日志**：`{'error':'Invalid state parameter'}`

**排查链**：

1. state 参数在 OAuth 登录时生成，回调时校验
2. 发现 cookie 设置了 `Secure` 标志
3. 部署环境是 HTTP（HuggingFace Space），浏览器拒绝存储带 Secure 的 cookie
4. cookie 未发送 → state 为 undefined → 校验失败

**修复**：创建 `src/lib/cookie.ts` 工具函数，根据 `APP_URL` 协议动态决定 Secure 标志

### 案例 2：安装后检测不到

**日志**：`Unhandled event: installation`

**排查链**：

1. webhook 收到了 installation 事件
2. switch-case 中没有 installation 分支
3. 进入 default 分支只打印日志
4. GitHubInstallation 记录从未被创建

**修复**：在 webhook handler 中添加 installation 事件处理逻辑

### 案例 3：仓库列表为空

**日志**：`GITHUB_APP_ID and GITHUB_PRIVATE_KEY_PATH must be set`

**排查链**：

1. 私钥存储在数据库（WebhookConfig.privateKeyEncrypted）
2. generateJWT() 只从文件读取
3. 环境变量未设置 → 文件不存在 → 抛出错误

**修复**：创建 `getAppId()`/`getPrivateKey()` 统一获取函数，支持 env → AppConfig → WebhookConfig 三级回退

### 案例 4：私钥上传后仍无法读取

**日志**：`Failed to list repos for installation: private key not configured`

**排查链**：

1. 私钥通过 /api/github/private-key 上传
2. 存储到 AppConfig 表（key: github_private_key）
3. getPrivateKey() 从 WebhookConfig 表读取（不是 AppConfig）
4. 数据链路不匹配

**修复**：getPrivateKey() 添加 AppConfig 读取优先级

### 案例 5：ENCRYPTION_KEY not configured

**日志**：`ENCRYPTION_KEY not configured`

**排查链**：

1. 用户只有一个 ENCRYPTION_KEY
2. 代码只读取 ENCRYPTION_KEY
3. 用户说明两者等价

**修复**：`process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY` 回退

## 反模式（避免）

| 反模式                   | 正确做法                                   |
| ------------------------ | ------------------------------------------ |
| 只看第一个错误就修复     | 追踪完整错误链到根因                       |
| 一次性修改所有怀疑的文件 | 逐个修复，每次只改一个根因                 |
| 不运行测试就提交         | 每次修复后运行相关测试                     |
| 询问用户是否提交         | 直接提交推送（用户已明确要求）             |
| 忽略用户的环境信息       | 从日志中提取部署环境（HTTP/HTTPS、端口等） |

## 关键经验

1. **Cookie Secure 标志**：HTTP 环境下必须去掉 Secure，用工具函数统一管理
2. **Webhook 事件覆盖**：GitHub App 安装会发送 installation 事件，必须处理
3. **密钥存储位置**：统一获取函数，支持多级回退（env → DB → 默认值）
4. **Callback URL**：GitHub App 的 Callback URL 必须配置为正确的回调端点
5. **部署环境差异**：本地开发和生产环境可能不同（端口、协议、文件系统），代码必须兼容

## 验证清单

每次部署后修复完成后，确认以下事项：

- [ ] TypeScript 类型检查通过
- [ ] 相关测试通过
- [ ] 全量测试通过（174+ 用例）
- [ ] 提交信息清晰描述修复内容
- [ ] 已推送到远程仓库
- [ ] 告知用户需要验证什么
