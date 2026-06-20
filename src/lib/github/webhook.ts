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

  const expectedSignature = 'sha256=' +
    crypto.createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

  // 使用 timingSafeEqual 防止时序攻击
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
