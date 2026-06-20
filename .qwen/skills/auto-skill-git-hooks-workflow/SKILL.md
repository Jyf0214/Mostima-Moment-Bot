---
name: git-hooks-workflow-configuration
description: Git hooks setup with husky, lint-staged, pre-commit/pre-push configuration, and GitHub Actions workflow optimization
source: auto-skill
extracted_at: '2026-06-20T04:00:00.000Z'
---

# Git Hooks and Workflow Configuration

## Overview

Setting up Git hooks with husky for code quality checks and GitHub Actions workflow for CI/CD with Docker builds.

## Husky + lint-staged Setup

### Installation

```bash
npm install -D husky lint-staged prettier
npx husky init
```

### package.json Configuration

```json
{
  "scripts": {
    "prepare": "husky",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml}": ["prettier --write"]
  }
}
```

### pre-commit Hook (Husky v10+)

```bash
echo "🔍 Running pre-commit checks..."

# Run lint-staged (check staged files)
npx lint-staged

# TypeScript type check
echo "📝 Running TypeScript type check..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
  echo "❌ TypeScript type check failed"
  exit 1
fi

# Run tests
echo "🧪 Running tests..."
npm test
if [ $? -ne 0 ]; then
  echo "❌ Tests failed"
  exit 1
fi

echo "✅ Pre-commit checks passed"
```

**Husky v10 Breaking Change**: Remove `#!/bin/sh` and `. "$(dirname "$0")/_/husky.sh"` from hooks. Hooks are now plain shell scripts without the husky.sh sourcing.

### pre-push Hook (Husky v10+)

```bash
echo "🚀 Running pre-push checks..."

# Full build
echo "📦 Building application..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed. Push rejected."
  exit 1
fi

# Full test suite
echo "🧪 Running full test suite..."
npm test
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Push rejected."
  exit 1
fi

echo "✅ Pre-push checks passed"
```

## GitHub Actions Docker Build Workflow

### AMD64-Only Build (Fast)

```yaml
name: Docker 构建与推送

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: 检出代码
        uses: actions/checkout@v4

      - name: 设置 Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: 登录 GitHub Container Registry
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: 提取元数据（标签）
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha

      - name: 构建并推送 Docker 镜像
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64
```

### Optimized Dockerfile (Next.js Standalone)

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy Prisma schema and generate client
COPY prisma/ ./prisma/
RUN npx prisma generate

# Copy source and build
COPY . .
RUN npm run build

# Remove dev dependencies
RUN npm prune --omit=dev

ENV PORT=3001
EXPOSE ${PORT}

CMD ["sh", "-c", "npm start -- -p $PORT"]
```

## Common Issues and Fixes

### 1. Husky not found in Docker

**Problem**: `husky: not found` during `npm ci --production`

**Fix**: Use `--ignore-scripts` to skip prepare script:

```dockerfile
RUN npm ci --omit=dev --ignore-scripts
```

### 2. Prisma schema not found

**Problem**: `prisma generate` fails because schema file not copied

**Fix**: Copy prisma directory before generating:

```dockerfile
COPY prisma/ ./prisma/
RUN npx prisma generate
```

### 3. TypeScript compilation fails in Docker

**Problem**: Missing type definitions when using `--omit=dev`

**Fix**: Install all dependencies, build with Next.js, then prune:

```dockerfile
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build
RUN npm prune --omit=dev
```

### 4. Port configuration

**Problem**: Application ignores PORT environment variable

**Fix**: Next.js respects PORT env var. Use `npm start -- -p $PORT` in Docker:

```dockerfile
ENV PORT=3001
CMD ["sh", "-c", "npm start -- -p $PORT"]
```

## Verification Commands

```bash
# Test hooks locally
git add .
git commit -m "test"  # Should trigger pre-commit

# Test push hook
git push  # Should trigger pre-push

# Check workflow status
gh run list --limit 5
gh run view <run-id> --log-failed
```
