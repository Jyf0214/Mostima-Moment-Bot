# ============================================
# 构建阶段：安装依赖、生成 Prisma、构建 Next.js
# ============================================
FROM node:24-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci

# 复制 Prisma schema 并生成客户端
COPY prisma/ ./prisma/
RUN npx prisma generate

# 复制源代码
COPY . .

# 构建 Next.js
RUN npm run build

# 移除开发依赖
RUN npm prune --omit=dev

# ============================================
# 运行阶段：使用 Debian slim 镜像（支持 glibc，Runner 必需）
# ============================================
FROM node:24-slim

WORKDIR /app

# 安装系统依赖
# - gh: GitHub CLI（仓库克隆）
# - curl: Runner 下载和健康检查
# - jq: JSON 解析
# - libicu-dev: Runner 国际化支持
# - libssl-dev: Runner TLS 支持
# - git: 仓库操作
# - wget: 健康检查
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl jq git wget ca-certificates \
    libicu-dev libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制必要文件
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js ./next.config.js

# 安装 GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update && apt-get install gh -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 安装 PM2（用于管理 GitHub Actions Runner 进程）
RUN npm install -g pm2

# 下载并安装 GitHub Actions Runner（Linux x64）
ARG RUNNER_VERSION=2.322.0
RUN mkdir -p /home/node/actions-runner && \
    curl -sL "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
    -o /tmp/runner.tar.gz && \
    tar xzf /tmp/runner.tar.gz -C /home/node/actions-runner && \
    rm /tmp/runner.tar.gz && \
    chmod +x /home/node/actions-runner/run.sh && \
    chmod +x /home/node/actions-runner/config.sh && \
    chown -R node:node /home/node/actions-runner 

# 安装 qwen CLI（用于 CI 工作流执行代码修复）
RUN npm install -g @qwen-code/qwen-code@latest

# 修复 /app 目录权限，确保 node 用户可写（prisma db push 需要写入 @prisma/engines）
RUN chown -R node:node /app
RUN chown -R node:node /usr/local

ENV RUNNER_HOME=/home/node/actions-runner
ENV RUNNER_VERSION=${RUNNER_VERSION}
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# 切换到 node 用户运行
USER node

EXPOSE ${PORT}
RUN qwen -v
# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

# npm start = prisma db push --skip-generate && next start
CMD ["npm", "start"]
