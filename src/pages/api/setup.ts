import { NextApiRequest, NextApiResponse } from 'next';
import { setWebhookConfig } from '@/lib/db';
import { IncomingForm, File } from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * 设置 API
 * POST /api/setup
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const formData = await new Promise<{ fields: any; files: any }>((resolve, reject) => {
      const form = new IncomingForm({
        keepExtensions: true,
        maxFileSize: 10 * 1024, // 10KB
      });

      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const { fields, files } = formData;

    // 验证必填字段
    const appId = fields.appId?.[0];
    const webhookSecret = fields.webhookSecret?.[0];
    const repoOwner = fields.repoOwner?.[0];
    const repoName = fields.repoName?.[0];
    const privateKeyFile = files.privateKey?.[0];

    if (!appId || !webhookSecret || !repoOwner || !repoName) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    if (!privateKeyFile) {
      return res.status(400).json({ error: '请上传私钥文件' });
    }

    // 读取私钥文件
    const privateKeyPath = privateKeyFile.filepath || privateKeyFile.path;
    if (!privateKeyPath) {
      return res.status(400).json({ error: '私钥文件路径无效' });
    }

    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

    // 验证私钥格式
    if (!privateKey.includes('-----BEGIN') || !privateKey.includes('PRIVATE KEY-----')) {
      return res.status(400).json({ error: '私钥文件格式无效' });
    }

    // 保存配置到数据库（私钥会被加密）
    await setWebhookConfig(
      appId,
      webhookSecret,
      privateKey,
      repoOwner,
      repoName
    );

    // 清理临时文件
    try {
      fs.unlinkSync(privateKeyPath);
    } catch (e) {
      // 忽略清理错误
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('设置失败:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
