FROM node:20-alpine

WORKDIR /app

# 安装所有依赖（包括 dev 依赖用于 TypeScript 编译）
COPY package*.json ./
RUN npm ci --ignore-scripts

# 复制 Prisma schema
COPY prisma/ ./prisma/

# 生成 Prisma Client
RUN npx prisma generate

# 复制源码和配置
COPY src/ ./src/
COPY tsconfig.server.json ./

# 编译 TypeScript
RUN npx tsc --project tsconfig.server.json

# 删除 dev 依赖，只保留生产依赖
RUN npm prune --omit=dev

# 创建工作区目录
RUN mkdir -p /app/workspace

# 默认端口
ENV BOT_PORT=3001
ENV PORT=3001

EXPOSE ${PORT}

CMD ["sh", "-c", "node dist/server.js"]
