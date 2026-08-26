'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import { ProCard } from '@/components/ui/ProCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toggle } from '@/components/ui/Toggle';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { FolderGit2, ExternalLink, Settings } from 'lucide-react';
import { logger } from '@/lib/logger';
import { apiErrorMessage, apiJson, isUnauthorized, redirectToHome } from '@/lib/api-client';
import type { Repo, ReposData } from './types';

interface Props {
  repos: ReposData | null;
  reposLoading: boolean;
  onRefresh?: () => void;
}

export default function ReposPage({ repos, reposLoading, onRefresh }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const handleToggle = useCallback(
    async (repo: Repo) => {
      setTogglingId(repo.id);
      setToggleError(null);
      try {
        await apiJson('/api/github/repos/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoId: repo.id,
            repoFullName: repo.full_name,
            repoOwner: repo.owner.login,
            repoName: repo.name,
          }),
        });
        onRefresh?.();
      } catch (err) {
        if (isUnauthorized(err)) {
          redirectToHome();
          return;
        }
        logger.error('Toggle failed:', err);
        // 透出服务端返回的具体原因，而不是笼统的「切换失败」
        setToggleError(apiErrorMessage(err, t('repos.toggleFailed')));
      } finally {
        setTogglingId(null);
      }
    },
    [onRefresh, t]
  );

  const handleCardClick = useCallback(
    (repo: Repo) => {
      router.push(`/dashboard/repo?name=${encodeURIComponent(repo.full_name)}`);
    },
    [router]
  );

  // 初次加载（还没有任何数据）：骨架屏占位，形状贴近真实卡片
  if (repos === null && reposLoading) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <Skeleton className="h-[72px] w-full rounded-xl" />
        <Skeleton className="h-[72px] w-full rounded-xl" />
        <Skeleton className="h-[72px] w-full rounded-xl" />
        <Skeleton className="h-[72px] w-full rounded-xl" />
      </div>
    );
  }

  if (!repos) {
    return (
      <EmptyState
        icon={<FolderGit2 className="h-10 w-10 text-zinc-300" />}
        title={t('repos.noData')}
      />
    );
  }

  const allRepos = [...repos.personal, ...repos.organization];

  return (
    <div className="space-y-4">
      {toggleError && <ErrorAlert message={toggleError} className="mb-2" />}

      {allRepos.length === 0 ? (
        <EmptyState
          icon={<FolderGit2 className="h-10 w-10 text-zinc-300" />}
          title={t('repos.noRepos')}
        />
      ) : (
        allRepos.map((repo) => (
          <ProCard
            key={repo.id}
            className="bg-white border-zinc-200 cursor-pointer hover:border-zinc-300 hover:shadow-sm transition-all"
            padding="p-4"
          >
            <div
              className="flex items-center justify-between"
              onClick={() => handleCardClick(repo)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <FolderGit2 className="h-4 w-4 text-zinc-400 shrink-0" />
                <p className="text-zinc-900 text-sm font-medium truncate">{repo.full_name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* 外层 span 阻止冒泡，避免点击开关触发整卡跳转 */}
                <span
                  className="inline-flex"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Toggle
                    checked={repo.enabled}
                    onChange={() => handleToggle(repo)}
                    disabled={togglingId === repo.id}
                    label={repo.enabled ? t('repos.disable') : t('repos.enable')}
                  />
                </span>
                <a
                  href={repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 hover:text-zinc-600"
                  onClick={(e) => e.stopPropagation()}
                  title="GitHub"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardClick(repo);
                  }}
                  className="text-zinc-400 hover:text-zinc-600"
                  title={t('repoDetail.repoSettings')}
                  aria-label={t('repoDetail.repoSettings')}
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>
            {repo.description && (
              <p className="text-zinc-500 text-xs mt-2 ml-7 truncate">{repo.description}</p>
            )}
          </ProCard>
        ))
      )}
    </div>
  );
}
