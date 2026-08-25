'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ReposPage from '@/components/dashboard/ReposPage';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { RefreshCw } from 'lucide-react';
import { apiErrorMessage, apiJson, isUnauthorized, redirectToHome } from '@/lib/api-client';
import type { ReposData } from '@/components/dashboard/types';

export default function ReposRoutePage() {
  const { t } = useTranslation();
  const [repos, setRepos] = useState<ReposData | null>(null);
  // 初值 true：首帧直接渲染骨架屏，而不是闪现空状态
  const [reposLoading, setReposLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadRepos = useCallback(async () => {
    setReposLoading(true);
    setLoadError(null);
    try {
      const data = await apiJson<ReposData>('/api/github/repos');
      setRepos(data);
    } catch (err) {
      if (isUnauthorized(err)) {
        redirectToHome();
        return;
      }
      // 加载失败必须显式提示，不能静默成「暂无数据」
      setLoadError(apiErrorMessage(err, t('dashboard.loadReposFailed')));
    } finally {
      setReposLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadRepos();
  }, [loadRepos]);

  return (
    <DashboardLayout
      activePage="repos"
      headerAction={
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw className={`h-3.5 w-3.5 ${reposLoading ? 'animate-spin' : ''}`} />}
          onClick={() => void loadRepos()}
          className="text-zinc-500 hover:text-zinc-700"
        >
          {t('dashboard.refresh')}
        </Button>
      }
    >
      {loadError && (
        <div className="mb-6">
          <ErrorAlert
            message={loadError}
            onRetry={() => void loadRepos()}
            retryLabel={t('common.retry')}
          />
        </div>
      )}
      <ReposPage repos={repos} reposLoading={reposLoading} onRefresh={loadRepos} />
    </DashboardLayout>
  );
}
