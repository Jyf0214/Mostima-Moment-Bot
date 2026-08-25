import { logger } from '@/lib/logger';
import { AppProps } from 'next/app';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import '@/i18n';
import '@/app/globals.css';
import { LoadingSpinner } from '@/components/ui/Button/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import TopProgressBar from '@/components/TopProgressBar';

/**
 * 全局环境门控状态机：
 * - checking：应用生命周期内首次进入时的全屏检查
 * - blocked：确认缺少必需环境变量，跳转 /env-error
 * - failed：env-check 本身网络失败/超时，展示可重试错误（绝不永久转圈）
 * - ready：放行渲染
 */
type GateStatus = 'checking' | 'blocked' | 'failed' | 'ready';

const ENV_CHECK_TIMEOUT_MS = 15000;

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [status, setStatus] = useState<GateStatus>('checking');
  // router 实例每次渲染都是新对象，绝不能作为依赖——否则每次点击侧边栏 tab
  // 都会重打 /api/env-check 和 POST /api/init。门控只在生命周期内按需执行。
  const gateRanRef = useRef(false);

  const runGate = useCallback(async () => {
    gateRanRef.current = true;

    if (router.pathname === '/env-error') {
      setStatus('ready');
      return;
    }

    try {
      // 超时兜底：接口挂起时不能永久遮罩页面
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ENV_CHECK_TIMEOUT_MS);
      let data: { isConfigured?: boolean; dbError?: boolean };
      try {
        const response = await fetch('/api/env-check', { signal: controller.signal });
        data = await response.json();
      } finally {
        clearTimeout(timeout);
      }

      if (!data.isConfigured) {
        router.push('/env-error');
        setStatus('blocked');
        return;
      }

      if (data.isConfigured) {
        try {
          // 初始化数据库（建表/加载数据库模式环境变量）；
          // 失败不阻断页面渲染，但记录错误以便排查
          await fetch('/api/init', { method: 'POST' });
        } catch (initErr) {
          logger.error('Database initialization failed:', initErr);
        }
      }

      setStatus('ready');
    } catch (err) {
      logger.error('Failed to check environment variables:', err);
      setStatus('failed');
    }
  }, [router]);

  useEffect(() => {
    if (gateRanRef.current) return;
    void runGate();
  }, [runGate]);

  const retryGate = () => {
    setStatus('checking');
    void runGate();
  };

  if (status === 'checking') {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-white p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-500" />
          <p className="text-base font-semibold text-zinc-900">{t('app.envCheckFailedTitle')}</p>
          <p className="mt-1 text-sm text-zinc-500">{t('app.envCheckFailedDesc')}</p>
          <Button variant="default" size="sm" onClick={retryGate} className="mt-4">
            {t('common.retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <TopProgressBar />
      <Component {...pageProps} />
    </>
  );
}
