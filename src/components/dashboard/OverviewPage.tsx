'use client';

import { useTranslation } from 'react-i18next';
import { ProCard } from '@/components/ui/ProCard';
import type { ReposData } from './types';
import { Plug, FolderGit2, CheckCircle2, BarChart3 } from 'lucide-react';

interface OverviewPageProps {
  repos: ReposData | null;
  reposLoading: boolean;
  appConfigured: boolean | null;
  onInstall: () => void;
  onNavigateToRepos: () => void;
  onNavigateToEnv: () => void;
}

/* 已知限制：当前 Dashboard 切换频率低，未使用 React.memo 包裹；若后续出现性能瓶颈，可考虑 memo 优化 */
export default function OverviewPage({
  repos,
  reposLoading,
  appConfigured,
  onInstall,
  onNavigateToRepos,
  onNavigateToEnv,
}: OverviewPageProps) {
  const { t } = useTranslation();
  const hasInstallations = repos && repos.installations && repos.installations.length > 0;
  const totalRepos = repos ? repos.personal.length + repos.organization.length : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <ProCard className="bg-white border-zinc-200" padding="p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-zinc-100 flex items-center justify-center">
              <Plug className="h-4 w-4 text-zinc-500" />
            </div>
            <div>
              <p className="text-zinc-500 text-xs">{t('dashboard.activeInstallations')}</p>
              <p className="text-xl font-bold text-zinc-900">
                {reposLoading ? '...' : repos?.installations.length || 0}
              </p>
            </div>
          </div>
        </ProCard>
        <ProCard className="bg-white border-zinc-200" padding="p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <FolderGit2 className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-zinc-500 text-xs">{t('dashboard.totalRepos')}</p>
              <p className="text-xl font-bold text-zinc-900">{reposLoading ? '...' : totalRepos}</p>
            </div>
          </div>
        </ProCard>
        <ProCard className="bg-white border-zinc-200" padding="p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-zinc-500 text-xs">{t('envPage.configured')}</p>
              <p className="text-xl font-bold text-zinc-900">
                {appConfigured === null ? '...' : appConfigured ? '✓' : '—'}
              </p>
            </div>
          </div>
        </ProCard>
      </div>

      <ProCard className="bg-white border-zinc-200" padding="p-5">
        <h3 className="text-sm font-medium text-zinc-500 mb-4">{t('dashboard.quickActions')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!hasInstallations && appConfigured !== false ? (
            <button
              onClick={onInstall}
              className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 hover:border-blue-300 transition-all text-left"
            >
              <Plug className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-zinc-900 text-sm font-medium">{t('home.installApp')}</p>
                <p className="text-zinc-500 text-xs">{t('home.installAppDesc')}</p>
              </div>
            </button>
          ) : (
            <button
              onClick={onNavigateToRepos}
              className="flex items-center gap-3 p-4 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 hover:shadow-md transition-all text-left"
            >
              <FolderGit2 className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-zinc-900 text-sm font-medium">{t('home.repositories')}</p>
                <p className="text-zinc-500 text-xs">
                  {totalRepos} {t('home.repositories')}
                </p>
              </div>
            </button>
          )}
          <button
            onClick={onNavigateToEnv}
            className="flex items-center gap-3 p-4 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 hover:shadow-md transition-all text-left"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <div>
              <p className="text-zinc-900 text-sm font-medium">{t('sidebar.envVars')}</p>
              <p className="text-zinc-500 text-xs">{t('envPage.subtitle')}</p>
            </div>
          </button>
          <button
            onClick={() => (window.location.href = '/github-test')}
            className="flex items-center gap-3 p-4 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 hover:shadow-md transition-all text-left"
          >
            <BarChart3 className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-zinc-900 text-sm font-medium">{t('dashboard.testConnection')}</p>
              <p className="text-zinc-500 text-xs">{t('dashboard.testConnectionDesc')}</p>
            </div>
          </button>
        </div>
      </ProCard>
    </div>
  );
}
