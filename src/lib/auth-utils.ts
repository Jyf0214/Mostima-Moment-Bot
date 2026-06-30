import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

/**
 * 统一的 JWT 载荷接口
 * 所有字段均为可选，以适配不同场景（简单验签、管理员校验、用户信息提取）
 */
export interface JwtPayload {
  githubId?: number;
  githubLogin?: string;
  avatarUrl?: string;
  isAdmin?: boolean;
}

/**
 * 获取 JWT 密钥
 * 统一从环境变量读取，未配置时抛出错误
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not configured');
  }
  return secret;
}

/**
 * 验证认证令牌，返回解码后的载荷
 * 使用环境变量中的 JWT_SECRET
 * @throws jwt 验证失败时抛出异常
 */
export function verifyAuthToken(token: string): JwtPayload {
  const secret = getJwtSecret();
  return jwt.verify(token, secret) as JwtPayload;
}

/**
 * 使用指定密钥验证 JWT 令牌
 * 适用于需要自定义密钥来源的场景（如从数据库读取 JWT_SECRET）
 * @throws jwt 验证失败时抛出异常
 */
export function verifyTokenWithSecret(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret) as JwtPayload;
}

/**
 * 从请求中提取并验证认证令牌（中间件）
 * 返回 null 表示未认证或令牌无效（响应已发送）
 */
export async function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<JwtPayload | null> {
  const token = req.cookies.auth_token;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  try {
    return verifyAuthToken(token);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
}

/**
 * 要求管理员权限的中间件
 * 验证令牌 + 检查 isAdmin 字段
 * 返回 null 表示未认证、令牌无效或非管理员（响应已发送）
 */
export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<JwtPayload | null> {
  const payload = await requireAuth(req, res);
  if (!payload) return null;
  if (!payload.isAdmin) {
    res.status(403).json({ error: 'Admin only' });
    return null;
  }
  return payload;
}
