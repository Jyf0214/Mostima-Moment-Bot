'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Database, RefreshCw } from 'lucide-react';
import { ProCard } from '@/components/ui/ProCard';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { SuccessAlert } from '@/components/ui/SuccessAlert';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { apiErrorMessage, apiJson, isUnauthorized, redirectToHome } from '@/lib/api-client';

/** 数据库运行模式卡片：状态查询 / 启用 / 停用（停用为危险操作，需二次确认） */
export function DbModeCard() {
  const { t } = useTranslation();
  // null 表示未知
  const [dbModeEnabled, setDbModeEnabled] = useState<boolean | null>(null);
  const [dbModeEnvCount, setDbModeEnvCount] = useState(0);
  const [dbModeLoading, setDbModeLoading] = useState(false);
  const [dbModeMsg, setDbModeMsg] = useState<string | null>(null);
  const [dbModeMsgType, setDbModeMsgType] = useState<'success' | 'error'>('success');

  const fetchDbModeStatus = async () => {
    try {
      const data = await apiJson<{ enabled: boolean; envCount: number }>('/api/env-db-mode');
      setDbModeEnabled(data.enabled);
      setDbModeEnvCount(data.envCount);
    } catch (err) {
      if (isUnauthorized(err)) redirectToHome();
      /* 失败时保持未知态，不误报「未启用」 */
    }
  };

  useEffect(() => {
    void fetchDbModeStatus();
  }, []);

  const enableDbMode = async () => {
    setDbModeLoading(true);
    setDbModeMsg(null);
    try {
      const data = await apiJson<{ envCount: number }>('/api/env-db-mode', { method: 'POST' });
      setDbModeMsgType('success');
      setDbModeMsg(t('settings.dbModeEnabled', { count: data.envCount }));
      setDbModeEnabled(true);
      setDbModeEnvCount(data.envCount);
    } catch (err) {
      if (isUnauthorized(err)) {
        redirectToHome();
        return;
      }
      setDbModeMsgType('error');
      setDbModeMsg(apiErrorMessage(err, t('settings.dbModeEnableFailed')));
    } finally {
      setDbModeLoading(false);
    }
  };

  const disableDbMode = async () => {
    // 危险操作：停用后环境变量恢复为仅从环境读取，需二次确认（与其他页面的删除确认对齐）
    if (!window.confirm(t('settings.dbModeDisableConfirm'))) {
      return;
    }
    setDbModeLoading(true);
    setDbModeMsg(null);
    try {
      await apiJson('/api/env-db-mode', { method: 'DELETE' });
      setDbModeMsgType('success');
      setDbModeMsg(t('settings.dbModeDisabled'));
      setDbModeEnabled(false);
      setDbModeEnvCount(0);
    } catch (err) {
      if (isUnauthorized(err)) {
        redirectToHome();
        return;
      }
      setDbModeMsgType('error');
      setDbModeMsg(apiErrorMessage(err, t('settings.dbModeDisableFailed')));
    } finally {
      setDbModeLoading(false);
    }
  };

  return (
    <ProCard className="bg-white border-zinc-200" padding="p-5">
      <div className="flex items-center gap-3 mb-4">
        <Database className="h-5 w-5 text-zinc-500" />
        <h3 className="text-zinc-900 font-medium">{t('settings.dbMode')}</h3>
      </div>
      <p className="text-zinc-500 text-xs mb-4">{t('settings.dbModeDescription')}</p>

      <div className="flex items-center gap-2 mb-4">
        {dbModeEnabled === null ? (
          /* 状态查询中先占位，避免误闪「未启用」 */
          <Skeleton className="h-4 w-28" />
        ) : dbModeEnabled ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm text-zinc-700">
              {t('settings.dbModeStatusEnabled', { count: dbModeEnvCount })}
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-zinc-700">{t('settings.dbModeStatusDisabled')}</span>
          </>
        )}
        {/* 查询失败时保持未知态，提供手动重试出口 */}
        {dbModeEnabled === null && !dbModeLoading && (
          <button
            type="button"
            onClick={() => void fetchDbModeStatus()}
            className="inline-flex items-center gap-1 rounded-md p-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <RefreshCw className="h-3 w-3" />
            {t('common.retry')}
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {!dbModeEnabled ? (
          <Button
            variant="default"
            icon={<Database className="h-4 w-4" />}
            onClick={enableDbMode}
            loading={dbModeLoading}
            disabled={dbModeEnabled === null || dbModeLoading}
            className="border-indigo-600 bg-indigo-600 text-white hover:border-indigo-700 hover:bg-indigo-700 hover:text-white"
          >
            {t('settings.dbModeEnable')}
          </Button>
        ) : (
          <Button
            variant="default"
            icon={<Database className="h-4 w-4" />}
            onClick={disableDbMode}
            loading={dbModeLoading}
            disabled={dbModeEnabled === null || dbModeLoading}
            className="border-zinc-100 bg-zinc-100 text-zinc-700 hover:border-zinc-200 hover:bg-zinc-200 hover:text-zinc-700"
          >
            {t('settings.dbModeDisable')}
          </Button>
        )}
      </div>

      {dbModeMsg &&
        (dbModeMsgType === 'success' ? (
          <SuccessAlert message={dbModeMsg} />
        ) : (
          <ErrorAlert message={dbModeMsg} className="mt-3" />
        ))}

      <p className="mt-3 text-xs text-zinc-500">{t('settings.dbModeHint')}</p>
    </ProCard>
  );
}
