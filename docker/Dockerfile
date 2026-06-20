FROM node:20-alpine

WORKDIR /app

# 安装依赖（跳过 prepare 脚本避免 husky 错误）
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# 生成 Prisma Client
RUN npx prisma generate

# 复制源码
COPY src/ ./src/
COPY tsconfig.server.json ./

# 编译 TypeScript
RUN npx tsc --project tsconfig.server.json

# 创建工作区目录
RUN mkdir -p /app/workspace

EXPOSE 3001

CMD ["node", "dist/server.js"]
