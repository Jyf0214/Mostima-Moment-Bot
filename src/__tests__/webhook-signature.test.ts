import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyWebhookSignature } from '@/lib/github/webhook';

describe('Webhook 签名验证', () => {
  const secret = 'test-webhook-secret';

  function sign(body: string, sec: string): string {
    return 'sha256=' + crypto.createHmac('sha256', sec).update(body).digest('hex');
  }

  it('应该验证有效的签名', () => {
    const body = Buffer.from('{"action":"opened"}');
    const signature = sign(body.toString(), secret);

    expect(verifyWebhookSignature(body, signature, secret)).toBe(true);
  });

  it('应该拒绝错误的密钥', () => {
    const body = Buffer.from('{"action":"opened"}');
    const signature = sign(body.toString(), 'wrong-secret');

    expect(verifyWebhookSignature(body, signature, secret)).toBe(false);
  });

  it('应该拒绝篡改的请求体', () => {
    const body = Buffer.from('{"action":"opened"}');
    const tamperedBody = Buffer.from('{"action":"closed"}');
    const signature = sign(body.toString(), secret);

    expect(verifyWebhookSignature(tamperedBody, signature, secret)).toBe(false);
  });

  it('应该拒绝空签名', () => {
    const body = Buffer.from('test');
    expect(verifyWebhookSignature(body, '', secret)).toBe(false);
  });

  it('应该拒绝空密钥', () => {
    const body = Buffer.from('test');
    const signature = sign(body.toString(), secret);
    expect(verifyWebhookSignature(body, signature, '')).toBe(false);
  });

  it('签名长度不匹配时应该返回 false（不抛出 RangeError）', () => {
    const body = Buffer.from('test');
    const shortSig = 'sha256=abc';
    expect(verifyWebhookSignature(body, shortSig, secret)).toBe(false);
  });

  it('应该处理空请求体', () => {
    const body = Buffer.from('');
    const signature = sign('', secret);
    expect(verifyWebhookSignature(body, signature, secret)).toBe(true);
  });

  it('应该处理大型请求体', () => {
    const body = Buffer.from('x'.repeat(100000));
    const signature = sign(body.toString(), secret);
    expect(verifyWebhookSignature(body, signature, secret)).toBe(true);
  });

  it('应该拒绝不含 sha256= 前缀的签名', () => {
    const body = Buffer.from('test');
    const badPrefix = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyWebhookSignature(body, badPrefix, secret)).toBe(false);
  });
});
