'use client';

import { useRouter } from 'next/router';
import { useEffect } from 'react';

/**
 * /dashboard/logs/[repo] 旧路由兼容页面
 * 重定向到 /dashboard?logsRepo={repo}，避免 %2F 编码问题
 */
export default function RepoLogsRedirect() {
  const router = useRouter();
  const repo = typeof router.query.repo === 'string' ? router.query.repo : '';

  useEffect(() => {
    if (repo) {
      window.location.href = `/dashboard?logsRepo=${repo}`;
    } else {
      window.location.href = '/dashboard';
    }
  }, [repo]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-white/20 border-t-purple-500" />
    </div>
  );
}
