import { encrypt, decrypt, generateEncryptionKey } from '@/lib/crypto';

describe('Crypto 模块', () => {
  const testPassword = 'test-password-123';

  it('应该正确加密和解密数据', () => {
    const originalData = '这是一段测试数据';
    const encrypted = encrypt(originalData, testPassword);
    const decrypted = decrypt(encrypted, testPassword);

    expect(decrypted).toBe(originalData);
  });

  it('不同的密码应该抛出解密错误', () => {
    const originalData = '敏感数据';
    const encrypted = encrypt(originalData, 'password1');

    expect(() => decrypt(encrypted, 'password2')).toThrow();
  });

  it('应该生成随机加密密钥', () => {
    const key1 = generateEncryptionKey();
    const key2 = generateEncryptionKey();

    expect(key1).not.toBe(key2);
    expect(key1).toHaveLength(64); // 32 bytes = 64 hex chars
    expect(key2).toHaveLength(64);
  });

  it('应该处理空字符串', () => {
    const originalData = '';
    const encrypted = encrypt(originalData, testPassword);
    const decrypted = decrypt(encrypted, testPassword);

    expect(decrypted).toBe(originalData);
  });

  it('应该处理特殊字符', () => {
    const originalData = '特殊字符: !@#$%^&*()_+{}|:"<>?';
    const encrypted = encrypt(originalData, testPassword);
    const decrypted = decrypt(encrypted, testPassword);

    expect(decrypted).toBe(originalData);
  });

  it('应该处理中文字符', () => {
    const originalData = '中文测试：你好世界';
    const encrypted = encrypt(originalData, testPassword);
    const decrypted = decrypt(encrypted, testPassword);

    expect(decrypted).toBe(originalData);
  });

  it('加密格式应该正确', () => {
    const originalData = '测试数据';
    const encrypted = encrypt(originalData, testPassword);

    // 格式：salt:iv:tag:encrypted
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toHaveLength(128); // salt: 64 hex chars
    expect(parts[1]).toHaveLength(32);  // iv: 16 hex chars
    expect(parts[2]).toHaveLength(32);  // tag: 16 hex chars
  });

  it('解密无效格式应该抛出错误', () => {
    expect(() => decrypt('invalid-format', testPassword)).toThrow('Invalid encrypted data format');
  });
});
