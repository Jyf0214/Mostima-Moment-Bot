/**
 * 机器人配置
 *
 * 从环境变量读取机器人名称，用于 Issue 评论触发匹配。
 * 优先使用 BOT_NAME，其次使用 GITHUB_APP_SLUG。
 */

export function getBotSlug(): string {
  return process.env.BOT_NAME || process.env.GITHUB_APP_SLUG || 'qwen-code';
}

/** 返回 @机器人名称 格式，如 @manticore-bot */
export function getBotMention(): string {
  return `@${getBotSlug()}`;
}

/** 返回 /fix 命令的完整前缀，如 @manticore-bot /fix */
export function getFixCommand(): string {
  return `${getBotMention()} /fix`;
}
