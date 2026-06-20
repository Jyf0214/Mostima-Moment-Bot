import jwt from 'jsonwebtoken';
import fs from 'fs';
import { getDecryptedWebhookConfig, getConfig } from '@/lib/db';

/**
 * 获取 GitHub App ID
 * 优先级：环境变量 → AppConfig → WebhookConfig
 */
export async function getAppId(): Promise<string> {
  const envAppId = process.env.GITHUB_APP_ID;
  if (envAppId) return envAppId;

  // 从 AppConfig 读取
  const configAppId = await getConfig('github_app_id');
  if (configAppId) return configAppId;

  // 从 WebhookConfig 读取
  const whConfig = await getDecryptedWebhookConfig();
  if (whConfig?.appId) return whConfig.appId;

  throw new Error('GITHUB_APP_ID not configured (neither env nor database)');
}

/**
 * 获取 GitHub App 私钥
 * 优先级：环境变量文件 → AppConfig → WebhookConfig
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

  // 2. 从 AppConfig 读取（网页上传的私钥）
  const appConfigKey = await getConfig('github_private_key');
  if (appConfigKey) return appConfigKey;

  // 3. 从 WebhookConfig 读取
  const whConfig = await getDecryptedWebhookConfig();
  if (whConfig?.privateKey) return whConfig.privateKey;

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
