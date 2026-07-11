'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ReposPage from '@/components/dashboard/ReposPage';
import { Button } from '@/components/ui/Button';
import { RefreshCw } from 'lucide-react';
import type { ReposData } from '@/components/dashboard/types';

export default function ReposRoutePage() {
  const { t } = useTranslation();
  const [repos, setRepos] = useState<ReposData | null>(null);
  const [reposLoading, setReposLoading] = useState(false);

  const loadRepos = useCallback(async () => {
    setReposLoading(true);
    try {
      const res = await fetch('/api/github/repos');
      if (res.ok) setRepos(await res.json());
    } catch {
      /* 加载失败时保持当前状态 */
    } finally {
      setReposLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  return (
    <DashboardLayout activePage="repos">
      <div className="flex items-center justify-between mb-6">
        <div />
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw className={`h-3.5 w-3.5 ${reposLoading ? 'animate-spin' : ''}`} />}
          onClick={loadRepos}
          className="text-zinc-500 hover:text-zinc-700"
        >
          {t('dashboard.refresh')}
        </Button>
      </div>
      <ReposPage repos={repos} reposLoading={reposLoading} onRefresh={loadRepos} />
    </DashboardLayout>
  );
}
