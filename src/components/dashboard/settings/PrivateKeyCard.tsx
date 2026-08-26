'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, HelpCircle, Lock } from 'lucide-react';
import { ProCard } from '@/components/ui/ProCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { SuccessAlert } from '@/components/ui/SuccessAlert';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { apiErrorMessage, apiJson, isUnauthorized, redirectToHome } from '@/lib/api-client';

/** GitHub App 私钥状态与上传 */
export function PrivateKeyCard() {
  const { t } = useTranslation();
  const [privateKeyStatus, setPrivateKeyStatus] = useState<{
    configured: boolean;
    source: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadMsgType, setUploadMsgType] = useState<'success' | 'error'>('success');

  const checkPrivateKey = async () => {
    try {
      const data = await apiJson<{ configured: boolean; source: string }>(
        '/api/github/private-key'
      );
      setPrivateKeyStatus(data);
    } catch (err) {
      if (isUnauthorized(err)) {
        redirectToHome();
        return;
      }
      // 网络错误不能伪装成「未配置」，标记来源为 error 以显示中性的「状态未知」
      setPrivateKeyStatus({ configured: false, source: 'error' });
    }
  };

  const handleUploadPrivateKey = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 无论成功失败都复位 input，否则再次选择同一个文件不会触发 onChange
    const input = e.target;
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const content = await file.text();
      await apiJson('/api/github/private-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privateKey: content }),
      });
      setUploadMsgType('success');
      setUploadMsg(t('setup.privateKeySaved'));
      void checkPrivateKey();
    } catch (err) {
      if (isUnauthorized(err)) {
        redirectToHome();
        return;
      }
      setUploadMsgType('error');
      setUploadMsg(apiErrorMessage(err, t('setup.privateKeySaveFailed')));
    } finally {
      setUploading(false);
      input.value = '';
    }
  };

  return (
    <ProCard className="bg-white border-zinc-200" padding="p-5">
      <div className="flex items-center gap-3 mb-4">
        <Lock className="h-5 w-5 text-zinc-500" />
        <h3 className="text-zinc-900 font-medium">{t('setup.privateKey')}</h3>
      </div>
      {privateKeyStatus === null ? (
        <div className="mb-4">
          {/* 状态检查中先占位，避免误闪「未配置」 */}
          <Skeleton className="h-4 w-28" />
        </div>
      ) : (
        <div className="mb-4">
          <div className="flex items-center gap-2">
            {privateKeyStatus.configured ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm text-zinc-700">{t('setup.privateKeyConfigured')}</span>
              </>
            ) : privateKeyStatus.source === 'error' ? (
              <>
                {/* 网络错误等异常显示中性灰色的「状态未知」，不伪装成未配置 */}
                <HelpCircle className="h-4 w-4 text-zinc-400" />
                <span className="text-sm text-zinc-500">{t('settings.statusUnknown')}</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-zinc-700">{t('setup.privateKeyNotConfigured')}</span>
              </>
            )}
          </div>
        </div>
      )}
      <label className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer">
        <input
          type="file"
          accept=".pem,.key"
          className="hidden"
          onChange={handleUploadPrivateKey}
          disabled={uploading}
        />
        {uploading ? t('setup.uploading') : t('setup.uploadPrivateKey')}
      </label>
      {uploadMsg &&
        (uploadMsgType === 'success' ? (
          <SuccessAlert message={uploadMsg} />
        ) : (
          <ErrorAlert message={uploadMsg} className="mt-3" />
        ))}
    </ProCard>
  );
}
