import crypto from 'crypto';
import { logger } from '../logger';

/**
 * 验证 GitHub Webhook HMAC-SHA256 签名
 *
 * 安全说明：
 * - 使用 timingSafeEqual 防止时序攻击
 * - 验证签名格式必须为 "sha256=<hex>" 格式
 * - 空签名、null、undefined 均返回 false
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  // 输入验证：空值检查
  if (!signature || !secret) {
    logger.warn('[Webhook] Signature verification failed: missing signature or secret');
    return false;
  }

  // 格式验证：必须为 "sha256=<hex>" 格式
  if (!signature.startsWith('sha256=')) {
    logger.warn('[Webhook] Signature verification failed: invalid format (missing sha256= prefix)');
    return false;
  }

  const expectedSignature =
    'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);

  // 长度不一致时直接返回 false，避免 timingSafeEqual 抛出 RangeError
  if (sigBuf.length !== expectedBuf.length) {
    logger.warn('[Webhook] Signature verification failed: length mismatch');
    return false;
  }

  // 使用 timingSafeEqual 防止时序攻击
  const isValid = crypto.timingSafeEqual(sigBuf, expectedBuf);
  if (!isValid) {
    logger.warn('[Webhook] Signature verification failed: signature mismatch');
  }
  return isValid;
}
