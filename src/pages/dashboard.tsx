'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import { logger } from '@/lib/logger';
import { apiErrorMessage, apiJson, isUnauthorized, redirectToHome } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { SuccessAlert } from '@/components/ui/SuccessAlert';
import type { SidebarPage } from '@/components/dashboard/Sidebar';
import OverviewPage from '@/components/dashboard/OverviewPage';
import ReposPage from '@/components/dashboard/ReposPage';
import WorkflowLogsPage from '@/components/dashboard/WorkflowLogsPage';
import RunnersPage from '@/components/dashboard/RunnersPage';
import EnvVarsPage from '@/components/dashboard/EnvVarsPage';
import ApiKeyPage from '@/components/dashboard/ApiKeyPage';
import SettingsPage from '@/components/dashboard/SettingsPage';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import type { ReposData } from '@/components/dashboard/types';
import { RefreshCw } from 'lucide-react';

const VALID_PAGES: SidebarPage[] = [
  'overview',
  'repos',
  'logs',
  'runners',
  'env',
  'apikeys',
  'settings',
];

export default function DashboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [activePage, setActivePage] = useState<SidebarPage>('overview');
  const [repos, setRepos] = useState<ReposData | null>(null);
  // 初值 true：避免鉴权完成前先闪一帧「无法加载数据」空状态
  const [reposLoading, setReposLoading] = useState(true);
  const [reposError, setReposError] = useState<string | null>(null);
  const [appConfigured, setAppConfigured] = useState<boolean | null>(null);
  const [installMsg, setInstallMsg] = useState<string | null>(null);
  const [installMsgType, setInstallMsgType] = useState<'success' | 'error'>('success');
  // 用户数据只在鉴权成功后拉取一次；后续更新走各页面的手动刷新
  const dataLoadedRef = useRef(false);

  // 从 URL 读取当前页面；非法 page 参数重置为概览并清理 URL，
  // 避免「地址栏是 ?page=bogus、界面却停在旧 tab」的不一致
  useEffect(() => {
    if (!router.isReady) return;
    const pageParam = router.query.page as string | undefined;
    if (pageParam && VALID_PAGES.includes(pageParam as SidebarPage)) {
      setActivePage(pageParam as SidebarPage);
    } else if (!pageParam) {
      setActivePage('overview');
    } else {
      setActivePage('overview');
      router.replace('/dashboard', undefined, { shallow: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅依赖 query.page 变化
  }, [router.isReady, router.query.page]);

  const checkAppConfig = useCallback(async () => {
    try {
      // 保留原始语义：只有 500（服务端判定未配置）才算未配置，
      // 其他响应（含重定向/4xx）都视为已配置
      const res = await fetch('/api/github/install');
      setAppConfigured(res.status !== 500);
    } catch (err) {
      logger.error('Failed to check app configuration:', err);
      setAppConfigured(false);
    }
  }, []);

  const loadRepos = useCallback(async () => {
    setReposLoading(true);
    setReposError(null);
    try {
      const data = await apiJson<ReposData>('/api/github/repos');
      setRepos(data);
    } catch (err) {
      if (isUnauthorized(err)) {
        redirectToHome();
        return;
      }
      logger.error('Failed to load repos:', err);
      // 加载失败必须显式提示，不能静默成「暂无数据」误导用户
      setReposError(apiErrorMessage(err, t('dashboard.loadReposFailed')));
    } finally {
      setReposLoading(false);
    }
  }, [t]);

  const handleUserLoaded = useCallback(() => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;
    void checkAppConfig();
    void loadRepos();
  }, [checkAppConfig, loadRepos]);

  useEffect(() => {
    if (!router.isReady) return;
    const install = router.query.install as string | undefined;
    if (install === 'success') {
      setInstallMsg(t('home.installSuccess'));
      setInstallMsgType('success');
    } else if (install === 'error') {
      setInstallMsg(t('home.installError'));
      setInstallMsgType('error');
    }
    if (install) {
      router.replace({ pathname: '/dashboard' }, undefined, { shallow: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅依赖 install 参数变化
  }, [router.isReady, router.query.install]);

  const navigateTo = useCallback(
    (page: SidebarPage) => {
      setActivePage(page);
      router.push({ pathname: '/dashboard', query: { page } }, undefined, { shallow: true });
    },
    [router]
  );

  return (
    <DashboardLayout
      activePage={activePage}
      onUserLoaded={handleUserLoaded}
      headerAction={
        activePage === 'repos' ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className={`h-3.5 w-3.5 ${reposLoading ? 'animate-spin' : ''}`} />}
            onClick={() => void loadRepos()}
            className="text-zinc-500 hover:text-zinc-700"
          >
            {t('dashboard.refresh')}
          </Button>
        ) : undefined
      }
    >
      {installMsg &&
        (installMsgType === 'success' ? (
          <SuccessAlert message={installMsg} className="mb-6" />
        ) : (
          <ErrorAlert message={installMsg} className="mb-6" />
        ))}

      {/* 仓库加载失败横幅只在 overview/repos tab 展示，
          避免切到 settings/logs 等无关页面时仍挂着仓库报错 */}
      {reposError && (activePage === 'overview' || activePage === 'repos') && (
        <div className="mb-6">
          <ErrorAlert
            message={reposError}
            onRetry={() => void loadRepos()}
            retryLabel={t('common.retry')}
          />
        </div>
      )}

      {activePage === 'overview' && (
        <OverviewPage
          repos={repos}
          reposLoading={reposLoading}
          appConfigured={appConfigured}
          onInstall={() => (window.location.href = '/api/github/install')}
          onNavigateToRepos={() => navigateTo('repos')}
          onNavigateToEnv={() => navigateTo('env')}
        />
      )}
      {activePage === 'repos' && (
        <ReposPage repos={repos} reposLoading={reposLoading} onRefresh={loadRepos} />
      )}
      {activePage === 'logs' && <WorkflowLogsPage />}
      {activePage === 'runners' && <RunnersPage />}
      {activePage === 'env' && <EnvVarsPage />}
      {activePage === 'apikeys' && <ApiKeyPage />}
      {activePage === 'settings' && <SettingsPage />}
    </DashboardLayout>
  );
}
