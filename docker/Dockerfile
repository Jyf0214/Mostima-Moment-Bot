FROM node:20-alpine

WORKDIR /app

# 安装所有依赖（包括 dev 依赖用于构建）
COPY package*.json ./
RUN npm ci --ignore-scripts

# 复制 Prisma schema
COPY prisma/ ./prisma/

# 生成 Prisma Client
RUN npx prisma generate

# 复制源码和配置
COPY . .

# 构建 Next.js 应用
RUN npm run build

# 删除 dev 依赖，只保留生产依赖
RUN npm prune --omit=dev

# 默认端口
ENV PORT=3001

EXPOSE ${PORT}

CMD ["sh", "-c", "npm start -- -p $PORT"]
