/**
 * 机器人配置
 *
 * Bot slug 始终通过 GitHub App ID 调用 GitHub API 获取（GET /app），不依赖任何环境变量。
 * 结果缓存在内存中，避免重复 API 调用。
 */

import { fetchBotSlug } from '@/lib/github/auth';

/** 异步获取完整 slug（GitHub API 自动获取 + 内存缓存） */
export async function resolveBotSlug(): Promise<string> {
  return await fetchBotSlug();
}

/** 返回 @机器人名称 格式（异步，用于规则匹配） */
export async function getBotMention(): Promise<string> {
  const slug = await resolveBotSlug();
  return `@${slug}`;
}
