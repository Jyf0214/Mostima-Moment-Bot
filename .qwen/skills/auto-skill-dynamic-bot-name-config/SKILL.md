---
name: dynamic-bot-name-config
description: 将硬编码的机器人标识符替换为 GITHUB_APP_SLUG 环境变量动态配置
source: auto-skill
extracted_at: '2026-06-21T00:11:16.822Z'
---

# 动态机器人名称配置

## 问题

GitHub App / Bot 的名称常被硬编码在触发条件、提示词、规则模式等多处。需要统一使用环境变量配置。

## 解决方案

### 1. 创建配置模块

新建 `lib/ci/config.ts`，统一读取 `GITHUB_APP_SLUG`：

```typescript
export function getBotSlug(): string {
  return process.env.GITHUB_APP_SLUG || '';
}

export function getBotMention(): string {
  return `@${getBotSlug()}`;
}

export function getFixCommand(): string {
  return `${getBotMention()} /fix`;
}
```

**直接使用 GITHUB_APP_SLUG，不引入额外环境变量。**

### 2. 替换硬编码引用

扫描所有包含 `@bot-name` 的文件，替换为函数调用：

| 位置         | 原代码                                        | 替换为                                                                     |
| ------------ | --------------------------------------------- | -------------------------------------------------------------------------- |
| 触发条件判断 | `body.startsWith('@qwen-code /fix')`          | `body.startsWith(getFixCommand())`                                         |
| 提示词模板   | `` `@qwen-code /fix ...` ``                   | `` `${getBotMention()} /fix ...` ``                                        |
| 正则模式     | `'^@qwen-code\\s+/fix'`                       | `` `^@${botSlug}\\s+/fix` ``                                               |
| 命令解析     | `comment.replace(/^@qwen-code\s*\/fix/i, '')` | `comment.replace(new RegExp(\`^${getBotMention()}\\s\*\\/fix\`, 'i'), '')` |

### 3. 规则配置函数化

将静态常量改为函数，运行时读取配置：

```typescript
export function getAutoFixRule(): TriggerRule {
  const botSlug = getBotSlug();
  return {
    commentPattern: `^@${botSlug}\\s+/fix`,
    // ...
  };
}
```

### 4. 更新测试

```typescript
import { getBotSlug } from '@/lib/ci/config';
commentBody: `@${getBotSlug()} /fix please help`,
```

## 关键文件

- `src/lib/ci/config.ts` — 机器人配置
- `src/lib/ci/issue-solver.ts` — Issue 触发条件
- `src/lib/qwen/prompts.ts` — AI 提示词模板
- `src/lib/ci/triggers/default-rules.ts` — 默认触发规则

## 注意事项

- 正则模式中需要转义 `@` 符号：`\\s+` 而非 `\s+`
- `RegExp` 构造函数中需要双重转义
- 注释和文档中也统一使用 `GITHUB_APP_SLUG`，禁止出现 `BOT_NAME`
