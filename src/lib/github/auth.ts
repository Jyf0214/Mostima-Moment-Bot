import jwt from 'jsonwebtoken';
import fs from 'fs';

/**
 * 生成 GitHub App JWT 临时令牌
 */
export function generateJWT(appId: string, privateKeyPath: string): string {
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iat: now - 60,  // 签发时间（提前 60 秒以应对时钟偏差）
    exp: now + (10 * 60),  // 10 分钟过期
    iss: appId,  // GitHub App ID
  };

  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}
