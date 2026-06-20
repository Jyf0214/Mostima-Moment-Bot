import { describe, it, expect, afterEach } from 'vitest';
import { setCookie, clearCookie } from '@/lib/cookie';

describe('Cookie 工具函数', () => {
  const originalEnv = process.env.APP_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.APP_URL;
    } else {
      process.env.APP_URL = originalEnv;
    }
  });

  describe('setCookie', () => {
    it('应该生成基本的 Set-Cookie 字符串', () => {
      const result = setCookie('test', 'value');
      expect(result).toContain('test=value');
      expect(result).toContain('Path=/');
      expect(result).toContain('Max-Age=600');
      expect(result).toContain('SameSite=Lax');
      expect(result).toContain('HttpOnly');
    });

    it('应该支持自定义 path', () => {
      const result = setCookie('test', 'value', { path: '/api/test' });
      expect(result).toContain('Path=/api/test');
    });

    it('应该支持自定义 maxAge', () => {
      const result = setCookie('test', 'value', { maxAge: 3600 });
      expect(result).toContain('Max-Age=3600');
    });

    it('应该支持禁用 httpOnly', () => {
      const result = setCookie('test', 'value', { httpOnly: false });
      expect(result).not.toContain('HttpOnly');
    });

    it('应该支持自定义 SameSite', () => {
      const result = setCookie('test', 'value', { sameSite: 'Strict' });
      expect(result).toContain('SameSite=Strict');
    });

    it('应该支持 None SameSite', () => {
      const result = setCookie('test', 'value', { sameSite: 'None' });
      expect(result).toContain('SameSite=None');
    });

    it('HTTP 环境下不应该包含 Secure 标志', () => {
      process.env.APP_URL = 'http://localhost:3001';
      const result = setCookie('test', 'value');
      expect(result).not.toContain('Secure');
    });

    it('HTTPS 环境下应该包含 Secure 标志', () => {
      process.env.APP_URL = 'https://example.com';
      const result = setCookie('test', 'value');
      expect(result).toContain('Secure');
    });

    it('APP_URL 未设置时不应该包含 Secure 标志', () => {
      delete process.env.APP_URL;
      const result = setCookie('test', 'value');
      expect(result).not.toContain('Secure');
    });

    it('应该正确处理特殊字符的 cookie 值', () => {
      const specialValue = 'abc123!@#$%';
      const result = setCookie('test', specialValue);
      expect(result).toContain(`test=${specialValue}`);
    });

    it('应该正确处理空字符串值', () => {
      const result = setCookie('test', '');
      expect(result).toContain('test=');
    });
  });

  describe('clearCookie', () => {
    it('应该生成清除 cookie 的字符串', () => {
      const result = clearCookie('test');
      expect(result).toContain('test=');
      expect(result).toContain('Max-Age=0');
      expect(result).toContain('Path=/');
    });

    it('应该支持自定义 path', () => {
      const result = clearCookie('test', { path: '/api/test' });
      expect(result).toContain('Path=/api/test');
      expect(result).toContain('Max-Age=0');
    });

    it('清除时 HTTP 环境不应该包含 Secure', () => {
      process.env.APP_URL = 'http://localhost:3001';
      const result = clearCookie('test');
      expect(result).not.toContain('Secure');
    });

    it('清除时 HTTPS 环境应该包含 Secure', () => {
      process.env.APP_URL = 'https://example.com';
      const result = clearCookie('test');
      expect(result).toContain('Secure');
    });
  });

  describe('多 cookie 组合', () => {
    it('应该支持同时设置多个 cookie', () => {
      const cookie1 = setCookie('auth_token', 'token123', { maxAge: 604800 });
      const cookie2 = setCookie('oauth_state', 'state456');

      expect(cookie1).toContain('auth_token=token123');
      expect(cookie1).toContain('Max-Age=604800');
      expect(cookie2).toContain('oauth_state=state456');
      expect(cookie2).toContain('Max-Age=600');
    });
  });
});
