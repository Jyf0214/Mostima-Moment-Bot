import { logger } from '../logger';
import { generateJWTAuto } from '../github/auth';
import { prisma } from '@/lib/prisma';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** 定时器 ID，用于清理 */
let refreshTimer: ReturnType<typeof setInterval> | null = null;

/** 刷新间隔（30 分钟） */
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

/** 缓存的 token */
let cachedToken: string | null = null;

/** 缓存的过期时间 */
let cachedTokenExpiresAt: number = 0;

/** 缓存提前过期时间（毫秒），避免在过期边界使用失效令牌 */
const CACHE_SAFETY_MARGIN_MS = 60_000;

/**
 * 获取 GitHub App 安装访问令牌
 *
 * 流程：
 * 1. 检查缓存是否有效
 * 2. 从数据库获取 installation ID
 * 3. 使用 App 私钥生成 JWT
 * 4. 调用 GitHub API 获取安装访问令牌
 */
async function generateInstallationToken(): Promise<string | null> {
  // 检查缓存
  if (cachedToken && Date.now() < cachedTokenExpiresAt - CACHE_SAFETY_MARGIN_MS) {
    return cachedToken;
  }

  try {
    // 1. 从数据库获取有效的 installation
    const installation = await prisma.gitHubInstallation.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!installation) {
      logger.warn('[Token Refresher] No active GitHub App installation found');
      return null;
    }

    // 2. 生成 JWT
    const jwt = await generateJWTAuto();

    // 3. 调用 GitHub API 获取安装访问令牌
    const response = await fetch(
      `https://api.github.com/app/installations/${installation.installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      logger.error(`[Token Refresher] Failed to get installation token: ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as { token: string; expires_at?: string };

    // 计算过期时间（默认 1 小时）
    const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + 3600000;

    // 更新缓存
    cachedToken = data.token;
    cachedTokenExpiresAt = expiresAt;

    return data.token;
  } catch (error) {
    logger.error('[Token Refresher] Failed to generate installation token:', error);
    return null;
  }
}

/**
 * 刷新 GitHub Token 并设置为环境变量
 */
async function refreshToken(): Promise<void> {
  logger.info('[Token Refresher] Refreshing GitHub App token...');

  const token = await generateInstallationToken();
  if (!token) {
    logger.warn('[Token Refresher] Failed to refresh token, keeping existing environment');
    return;
  }

  // 设置为环境变量
  process.env.GITHUB_TOKEN = token;
  process.env.GH_TOKEN = token;

  // 全局刷新 GitHub CLI 登录状态，使所有进程都能使用 gh 命令
  try {
    await execAsync(`echo "${token}" | gh auth login --with-token`);
    logger.info('[Token Refresher] GitHub CLI global auth refreshed successfully');
  } catch (error) {
    logger.warn(
      '[Token Refresher] Failed to refresh GitHub CLI auth (gh may not be installed):',
      error
    );
  }

  logger.info('[Token Refresher] GitHub App token refreshed successfully');
}

/**
 * 启动定时刷新服务
 *
 * 应用启动时调用，立即生成一次 token，然后每 30 分钟自动刷新
 */
export function startTokenRefresher(): void {
  // 启动时立即生成 token
  refreshToken().catch((err) => {
    logger.error('[Token Refresher] Initial refresh failed:', err);
  });

  // 设置定时刷新
  refreshTimer = setInterval(() => {
    refreshToken().catch((err) => {
      logger.error('[Token Refresher] Periodic refresh failed:', err);
    });
  }, REFRESH_INTERVAL_MS);

  logger.info('[Token Refresher] Started (interval: 30 minutes)');
}

/**
 * 停止定时刷新服务
 */
export function stopTokenRefresher(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
    logger.info('[Token Refresher] Stopped');
  }
}

/**
 * 重置 token 缓存（仅用于测试）
 */
export function resetTokenCache(): void {
  cachedToken = null;
  cachedTokenExpiresAt = 0;
}
