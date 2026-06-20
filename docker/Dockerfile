FROM node:20-slim AS base

# 安装必要的系统依赖
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 阶段 1：安装依赖
COPY package*.json ./
RUN npm ci --ignore-scripts

# 阶段 2：构建
COPY prisma/ ./prisma/
RUN npx prisma generate
COPY . .
RUN npm run build

# 阶段 3：生产镜像
FROM node:20-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# 复制 standalone 输出
COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static

# 确保 Prisma 引擎文件可执行
RUN chmod +x ./node_modules/.prisma/client/*.node 2>/dev/null || true

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

EXPOSE ${PORT}

CMD ["node", "server.js"]
