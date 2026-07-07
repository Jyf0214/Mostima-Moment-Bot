# ============================================
# 构建阶段：安装依赖、生成 Prisma、构建 Next.js
# ============================================
FROM node:20-alpine AS builder

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
# 运行阶段：仅包含运行时必要的文件
# ============================================
FROM node:20-alpine

WORKDIR /app

# 从构建阶段复制必要文件
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js ./next.config.js

# 获取 npm 全局安装目录并确保 node 用户有写权限
RUN NPM_GLOBAL_DIR=$(npm config get prefix)/lib/node_modules \
    && mkdir -p "$NPM_GLOBAL_DIR" \
    && chown -R node:node "$NPM_GLOBAL_DIR" \
    && mkdir -p /home/node/.npm \
    && chown -R node:node /home/node

# 以 node 身份全局安装 qwen CLI（用于 CI 工作流执行代码修复）
USER node
RUN npm install -g @qwen-code/qwen-code@latest

# 切回 root 设置应用目录权限
USER root
RUN chown -R node:node /app

USER node

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

EXPOSE ${PORT}

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

# npm start = prisma db push --skip-generate && next start
CMD ["npm", "start"]
