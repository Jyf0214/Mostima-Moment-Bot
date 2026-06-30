'use client';

import { useTranslation } from 'react-i18next';
import { ProCard } from '@/components/ui/ProCard';
import { FolderGit2, ExternalLink, CheckCircle2 } from 'lucide-react';
import type { ReposData } from './types';

interface Props {
  repos: ReposData | null;
  reposLoading: boolean;
}

/* 已知限制：当前仓库列表数据量小，未使用 React.memo 优化；若列表频繁重渲染，可考虑 memo 包裹 */
export default function ReposPage({ repos, reposLoading }: Props) {
  const { t } = useTranslation();

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
      {allRepos.length === 0 ? (
        <ProCard className="bg-white border-zinc-200" padding="p-6">
          <div className="flex items-center gap-3">
            <FolderGit2 className="h-5 w-5 text-zinc-400" />
            <p className="text-zinc-500 text-sm">{t('repos.noRepos')}</p>
          </div>
        </ProCard>
      ) : (
        /* 已知限制：当前仓库数量有限，.map 直接渲染即可；若仓库数量增长至上百，应考虑虚拟化列表 */
        allRepos.map((repo) => (
          <ProCard key={repo.id} className="bg-white border-zinc-200" padding="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FolderGit2 className="h-4 w-4 text-zinc-400" />
                <div>
                  <p className="text-zinc-900 text-sm font-medium">{repo.full_name}</p>
                  {repo.description && (
                    <p className="text-zinc-500 text-xs mt-0.5">{repo.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {repo.enabled && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                <a
                  href={repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 hover:text-zinc-600"
                  aria-label={`${repo.full_name} - ${t('repos.viewOnGithub')}`}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </ProCard>
        ))
      )}
    </div>
  );
}
