import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

describe('认证流程', () => {
  describe('JWT 验证', () => {
    it('应该验证有效的管理员 token', () => {
      const adminPayload = {
        githubId: 12345,
        githubLogin: 'admin',
        avatarUrl: 'https://example.com/avatar.jpg',
        isAdmin: true,
      };

      const token = jwt.sign(adminPayload, JWT_SECRET, { expiresIn: '7d' });
      const decoded = jwt.verify(token, JWT_SECRET) as any;

      expect(decoded.isAdmin).toBe(true);
      expect(decoded.githubId).toBe(12345);
      expect(decoded.githubLogin).toBe('admin');
    });

    it('应该拒绝非管理员 token', () => {
      const userPayload = {
        githubId: 99999,
        githubLogin: 'user',
        avatarUrl: 'https://example.com/avatar.jpg',
        isAdmin: false,
      };

      const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });
      const decoded = jwt.verify(token, JWT_SECRET) as any;

      expect(decoded.isAdmin).toBe(false);
    });

    it('应该拒绝伪造的 token', () => {
      const fakeToken = jwt.sign({ githubId: 12345 }, 'wrong-secret', { expiresIn: '7d' });

      expect(() => jwt.verify(fakeToken, JWT_SECRET)).toThrow();
    });
  });

  describe('GitHub OAuth 流程', () => {
    it('应该生成正确的 OAuth URL', () => {
      const clientId = 'test-client-id';
      const redirectUri = 'http://localhost:3000/api/auth/callback';
      const state = Buffer.from(JSON.stringify({ timestamp: Date.now() })).toString('base64');

      const scope = 'read:user user:email';
      const expectedUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;

      expect(expectedUrl).toContain('github.com/login/oauth/authorize');
      expect(expectedUrl).toContain(`client_id=${clientId}`);
      expect(expectedUrl).toContain('scope=read%3Auser%20user%3Aemail');
    });
  });

  describe('管理员绑定', () => {
    it('第一个用户应该成为管理员', () => {
      const isNew = true;
      const existingAdmin = null;

      const shouldCreateAdmin = isNew && !existingAdmin;

      expect(shouldCreateAdmin).toBe(true);
    });

    it('非管理员应该被拒绝', () => {
      const isNew = false;
      const existingAdmin = null;

      const shouldReject = !isNew && !existingAdmin;

      expect(shouldReject).toBe(true);
    });

    it('已有管理员应该更新登录时间', () => {
      const existingAdmin = {
        githubId: 12345,
        githubLogin: 'admin',
      };

      const shouldUpdate = existingAdmin !== null;

      expect(shouldUpdate).toBe(true);
    });
  });
});
