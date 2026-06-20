FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma/ ./prisma/
RUN npx prisma generate

# Copy source code
COPY . .

# Build Next.js
RUN npm run build

# Remove dev dependencies
RUN npm prune --omit=dev

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

EXPOSE ${PORT}

# npm start = prisma db push --skip-generate && next start
CMD ["npm", "start"]
