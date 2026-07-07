import jwt from 'jsonwebtoken';
import fs from 'fs';
import { getConfig } from '@/lib/db';
import { logger } from '@/lib/logger';

// 缓存 slug，避免重复 API 调用
let cachedSlug: string | null = null;

// 预热由 src/instrumentation.ts 的 register() 在服务器启动时触发

/**
 * 获取 GitHub App ID
 * 优先级：环境变量 → AppConfig
 */
export async function getAppId(): Promise<string> {
  const envAppId = process.env.GITHUB_APP_ID;
  if (envAppId) return envAppId;

  // 从 AppConfig 读取
  const configAppId = await getConfig('github_app_id');
  if (configAppId) return configAppId;

  throw new Error('GITHUB_APP_ID not configured (neither env nor database)');
}

/**
 * 获取 GitHub App 私钥
 * 优先级：环境变量文件 → AppConfig
 */
export async function getPrivateKey(): Promise<string> {
  // 1. 尝试从文件读取
  const privateKeyPath = process.env.GITHUB_PRIVATE_KEY_PATH;
  if (privateKeyPath) {
    try {
      return fs.readFileSync(privateKeyPath, 'utf8');
    } catch (err) {
      // 文件读取失败，继续尝试数据库
      logger.warn(`[GitHub Auth] Failed to read private key from file ${privateKeyPath}:`, err);
    }
  }

  // 2. 从 AppConfig 读取（网页上传的私钥）
  const appConfigKey = await getConfig('github_private_key');
  if (appConfigKey) return appConfigKey;

  throw new Error(
    'GitHub App private key not configured (neither GITHUB_PRIVATE_KEY_PATH nor database)'
  );
}

/**
 * 生成 GitHub App JWT 临时令牌
 * 支持两种调用方式：
 *   generateJWT(appId, privateKeyOrPath) — 旧接口，privateKeyOrPath 可以是文件路径或私钥字符串
 *   generateJWT(appId, privateKey) — 新接口，直接传入私钥字符串
 */
export function generateJWT(appId: string, privateKeyOrPath: string): string {
  let privateKey: string;

  // 判断传入的是文件路径还是私钥字符串
  if (privateKeyOrPath.includes('-----BEGIN')) {
    // 直接是私钥内容
    privateKey = privateKeyOrPath;
  } else {
    // 当作文件路径读取
    privateKey = fs.readFileSync(privateKeyOrPath, 'utf8');
  }

  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iat: now - 60,
    exp: now + 10 * 60,
    iss: appId,
  };

  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}

/**
 * 生成 JWT（使用统一获取函数）
 * 从环境变量或数据库自动获取 appId 和 privateKey
 */
export async function generateJWTAuto(): Promise<string> {
  const appId = await getAppId();
  const privateKey = await getPrivateKey();
  return generateJWT(appId, privateKey);
}

/**
 * 获取 GitHub App Slug
 * 优先级：内存缓存 → GitHub API 自动获取（首次调用时获取，之后永久缓存）
 */
export async function fetchBotSlug(): Promise<string> {
  // 1. 返回缓存
  if (cachedSlug) return cachedSlug;

  // 2. 环境变量
  const envSlug = process.env.GITHUB_APP_SLUG;
  if (envSlug) {
    cachedSlug = envSlug;
    return envSlug;
  }

  // 3. 调用 GitHub API 获取
  try {
    const appJwt = await generateJWTAuto();
    const response = await fetch('https://api.github.com/app', {
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (response.ok) {
      const app = (await response.json()) as { slug: string };
      if (app.slug) {
        cachedSlug = app.slug;
        return app.slug;
      }
    }
  } catch (err) {
    // API 调用失败，返回空
    logger.warn('[GitHub Auth] Failed to fetch bot slug from API:', err);
  }

  return '';
}
