FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --production

# 复制源码
COPY src/ ./src/
COPY tsconfig.server.json ./

# 编译 TypeScript
RUN npx tsc --project tsconfig.server.json

# 创建工作区目录
RUN mkdir -p /app/workspace

EXPOSE 3001

CMD ["node", "dist/server.js"]
