/**
 * 机器人配置
 *
 * getBotSlug() 同步返回环境变量值（用于静态规则初始化）
 * resolveBotSlug() 异步获取完整 slug（环境变量 → GitHub API）
 */

import { fetchBotSlug } from '@/lib/github/auth';

/** 同步获取 slug（仅环境变量，用于模块级常量初始化） */
export function getBotSlug(): string {
  return process.env.GITHUB_APP_SLUG || '';
}

/** 异步获取完整 slug（环境变量 → GitHub API 自动获取） */
export async function resolveBotSlug(): Promise<string> {
  return await fetchBotSlug();
}

/** 返回 @机器人名称 格式（同步版本，用于规则匹配） */
export function getBotMention(): string {
  return `@${getBotSlug()}`;
}

/** 返回 /fix 命令的完整前缀（同步版本） */
export function getFixCommand(): string {
  return `${getBotMention()} /fix`;
}
