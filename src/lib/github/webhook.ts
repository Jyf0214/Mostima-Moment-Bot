import crypto from 'crypto';

/**
 * 验证 GitHub Webhook HMAC-SHA256 签名
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  const expectedSignature =
    'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);

  // 长度不一致时直接返回 false，避免 timingSafeEqual 抛出 RangeError
  if (sigBuf.length !== expectedBuf.length) {
    return false;
  }

  // 使用 timingSafeEqual 防止时序攻击
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}
