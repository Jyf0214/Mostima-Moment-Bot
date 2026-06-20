---
name: dynamic-bot-name-config
description: 将硬编码的机器人标识符（如 @bot-name）替换为环境变量动态配置，支持多租户部署
source: auto-skill
extracted_at: '2026-06-20T23:39:01.773Z'
---

# 动态机器人名称配置

## 问题

GitHub App / Bot 的名称（如 `@qwen-code`、`@manticore-bot`）常被硬编码在触发条件、提示词、规则模式等多处。当需要为不同部署使用不同机器人名称时，需要逐一修改。

## 解决方案

### 1. 创建配置模块

新建 `lib/ci/config.ts`（或 `lib/bot-config.ts`），集中管理机器人标识符：

```typescript
export function getBotSlug(): string {
  return process.env.BOT_NAME || process.env.GITHUB_APP_SLUG || 'default-bot';
}

export function getBotMention(): string {
  return `@${getBotSlug()}`;
}

export function getFixCommand(): string {
  return `${getBotMention()} /fix`;
}
```

**配置优先级：** `BOT_NAME`（显式覆盖）→ `GITHUB_APP_SLUG`（自动推断）→ 默认值

### 2. 替换硬编码引用

扫描所有包含 `@bot-name` 的文件，替换为函数调用：

| 位置         | 原代码                                        | 替换为                                                                     |
| ------------ | --------------------------------------------- | -------------------------------------------------------------------------- |
| 触发条件判断 | `body.startsWith('@qwen-code /fix')`          | `body.startsWith(getFixCommand())`                                         |
| 提示词模板   | `` `@qwen-code /fix ...` ``                   | `` `${getBotMention()} /fix ...` ``                                        |
| 正则模式     | `'^@qwen-code\\s+/fix'`                       | `` `^@${botSlug}\\s+/fix` ``                                               |
| 命令解析     | `comment.replace(/^@qwen-code\s*\/fix/i, '')` | `comment.replace(new RegExp(\`^${getBotMention()}\\s\*\\/fix\`, 'i'), '')` |

### 3. 规则配置函数化

对于需要在模块加载时生成的规则（如 `commentPattern`），将常量改为函数：

```typescript
// ❌ 静态常量 — 无法感知运行时配置
export const AUTO_FIX_RULE: TriggerRule = {
  commentPattern: '^@qwen-code\\s+/fix',
};

// ✅ 函数生成 — 运行时读取配置
export function getAutoFixRule(): TriggerRule {
  const botSlug = getBotSlug();
  return {
    commentPattern: `^@${botSlug}\\s+/fix`,
    // ...
  };
}

// 保留旧导出以兼容测试
export const AUTO_FIX_RULE = getAutoFixRule();
```

### 4. 环境变量文档

在 `.env.example` 中添加：

```bash
# 机器人名称（用于 Issue 评论触发匹配，如 @manticore-bot /fix）
# 默认使用 GITHUB_APP_SLUG，可覆盖
BOT_NAME=your-bot-slug
```

### 5. 更新测试

测试中不应硬编码机器人名称，使用 `getBotSlug()` 动态获取：

```typescript
import { getBotSlug } from '@/lib/ci/config';

// ❌ 硬编码
commentBody: '@qwen-code /fix please help',

// ✅ 动态
commentBody: `@${getBotSlug()} /fix please help`,
```

## 关键文件

- `src/lib/ci/config.ts` — 机器人配置（`getBotSlug` / `getBotMention` / `getFixCommand`）
- `src/lib/ci/issue-solver.ts` — Issue 触发条件和命令解析
- `src/lib/qwen/prompts.ts` — AI 提示词模板
- `src/lib/ci/triggers/default-rules.ts` — 默认触发规则
- `.env.example` — 环境变量文档

## 扫描命令

快速查找所有硬编码的机器人名称引用：

```bash
grep -rn '@qwen-code\|@manticore-bot\|@your-bot' src/ --include='*.ts' --include='*.tsx'
```

## 注意事项

- 正则模式中需要转义 `@` 符号：`\\s+` 而非 `\s+`
- `RegExp` 构造函数中需要双重转义：`new RegExp(\`^${getBotMention()}\\\\s+/fix\`)`
- 保留旧的静态导出（标记 `@deprecated`）以避免破坏现有测试导入
