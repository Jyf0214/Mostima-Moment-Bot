import { encrypt, decrypt } from '@/lib/crypto';

describe('加密存储', () => {
  const encryptionKey = process.env.ENCRYPTION_KEY || 'test-encryption-key';

  describe('私钥加密', () => {
    it('应该正确加密和解密私钥', () => {
      const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MhgHcTz6sE2I2yPB
aFDrBz9vFqU5yTfMJPHE2TkDBAUflsYE5mWGT0RAQM9SD7yTJJHdVRAJm0MUFGXE
test-private-key-content
-----END RSA PRIVATE KEY-----`;

      const encrypted = encrypt(privateKey, encryptionKey);
      const decrypted = decrypt(encrypted, encryptionKey);

      expect(decrypted).toBe(privateKey);
      expect(encrypted).not.toBe(privateKey);
    });

    it('不同的私钥应该产生不同的密文', () => {
      const privateKey1 = '-----BEGIN RSA PRIVATE KEY-----\nkey1\n-----END RSA PRIVATE KEY-----';
      const privateKey2 = '-----BEGIN RSA PRIVATE KEY-----\nkey2\n-----END RSA PRIVATE KEY-----';

      const encrypted1 = encrypt(privateKey1, encryptionKey);
      const encrypted2 = encrypt(privateKey2, encryptionKey);

      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('Webhook Secret 加密', () => {
    it('应该正确加密和解密 Webhook Secret', () => {
      const webhookSecret = 'my-super-secret-webhook-secret-12345';

      const encrypted = encrypt(webhookSecret, encryptionKey);
      const decrypted = decrypt(encrypted, encryptionKey);

      expect(decrypted).toBe(webhookSecret);
    });
  });

  describe('安全特性', () => {
    it('使用错误的密钥应该无法解密', () => {
      const secret = 'sensitive-data';
      const encrypted = encrypt(secret, encryptionKey);

      expect(() => decrypt(encrypted, 'wrong-key')).toThrow();
    });

    it('加密数据应该包含 salt、iv、tag 和密文', () => {
      const data = 'test-data';
      const encrypted = encrypt(data, encryptionKey);

      const parts = encrypted.split(':');
      expect(parts).toHaveLength(4);

      // salt: 64 hex chars (32 bytes)
      expect(parts[0]).toHaveLength(128);
      // iv: 32 hex chars (16 bytes)
      expect(parts[1]).toHaveLength(32);
      // tag: 32 hex chars (16 bytes)
      expect(parts[2]).toHaveLength(32);
      // encrypted: hex string
      expect(parts[3]).toMatch(/^[0-9a-f]+$/);
    });
  });
});
