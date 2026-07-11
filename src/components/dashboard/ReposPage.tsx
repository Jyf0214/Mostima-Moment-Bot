'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import { ProCard } from '@/components/ui/ProCard';
import { FolderGit2, ExternalLink, Settings } from 'lucide-react';
import { logger } from '@/lib/logger';
import type { ReposData, Repo } from './types';

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
    async (repo: Repo, e: React.MouseEvent) => {
      e.stopPropagation();
      setTogglingId(repo.id);
      setToggleError(null);
      try {
        const res = await fetch('/api/github/repos/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoId: repo.id,
            repoFullName: repo.full_name,
            repoOwner: repo.owner.login,
            repoName: repo.name,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setToggleError(data.error || t('repos.toggleFailed'));
          logger.error(`Toggle failed: ${res.status}`);
        }
        onRefresh?.();
      } catch {
        setToggleError(t('repos.toggleFailed'));
        logger.error('Toggle request failed');
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

  if (reposLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-500" />
      </div>
    );
  }

  if (!repos) {
    return (
      <ProCard className="bg-white border-zinc-200" padding="p-6">
        <p className="text-zinc-500 text-sm">{t('repos.noData')}</p>
      </ProCard>
    );
  }

  const allRepos = [...repos.personal, ...repos.organization];

  return (
    <div className="space-y-4">
      {toggleError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {toggleError}
        </div>
      )}

      {allRepos.length === 0 ? (
        <ProCard className="bg-white border-zinc-200" padding="p-6">
          <div className="flex items-center gap-3">
            <FolderGit2 className="h-5 w-5 text-zinc-400" />
            <p className="text-zinc-500 text-sm">{t('repos.noRepos')}</p>
          </div>
        </ProCard>
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
                <button
                  onClick={(e) => handleToggle(repo, e)}
                  disabled={togglingId === repo.id}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    repo.enabled ? 'bg-emerald-500' : 'bg-zinc-300'
                  }`}
                  aria-label={repo.enabled ? t('repos.disable') : t('repos.enable')}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      repo.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
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
                  title={t('sidebar.repos')}
                  aria-label={t('sidebar.repos')}
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
