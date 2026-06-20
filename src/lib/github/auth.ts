import jwt from 'jsonwebtoken';
import fs from 'fs';
import { getDecryptedWebhookConfig } from '@/lib/db';

/**
 * 获取 GitHub App ID
 * 优先从环境变量读取，回退到数据库
 */
export async function getAppId(): Promise<string> {
  const envAppId = process.env.GITHUB_APP_ID;
  if (envAppId) return envAppId;

  const config = await getDecryptedWebhookConfig();
  if (config?.appId) return config.appId;

  throw new Error('GITHUB_APP_ID not configured (neither env nor database)');
}

/**
 * 获取 GitHub App 私钥
 * 优先从文件读取（GITHUB_PRIVATE_KEY_PATH），回退到数据库（WebhookConfig）
 */
export async function getPrivateKey(): Promise<string> {
  // 1. 尝试从文件读取
  const privateKeyPath = process.env.GITHUB_PRIVATE_KEY_PATH;
  if (privateKeyPath) {
    try {
      return fs.readFileSync(privateKeyPath, 'utf8');
    } catch {
      // 文件读取失败，继续尝试数据库
    }
  }

  // 2. 从数据库读取
  const config = await getDecryptedWebhookConfig();
  if (config?.privateKey) return config.privateKey;

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
