'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/Button';
import Sidebar, { type SidebarPage } from '@/components/dashboard/Sidebar';
import OverviewPage from '@/components/dashboard/OverviewPage';
import ReposPage from '@/components/dashboard/ReposPage';
import WorkflowLogsPage from '@/components/dashboard/WorkflowLogsPage';
import EnvVarsPage from '@/components/dashboard/EnvVarsPage';
import ApiKeyPage from '@/components/dashboard/ApiKeyPage';
import SettingsPage from '@/components/dashboard/SettingsPage';
import type { User, ReposData } from '@/components/dashboard/types';
import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState<SidebarPage>('overview');
  const [logsRepo, setLogsRepo] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [repos, setRepos] = useState<ReposData | null>(null);
  const [reposLoading, setReposLoading] = useState(false);
  const [appConfigured, setAppConfigured] = useState<boolean | null>(null);
  const [installMsg, setInstallMsg] = useState<string | null>(null);
  const [installMsgType, setInstallMsgType] = useState<'success' | 'error'>('success');

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        setInstallMsg(t('home.checkStatusFailed'));
        setInstallMsgType('error');
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
        return;
      }
      const data = await response.json();
      if (!data.githubId) {
        setInstallMsg(t('home.checkStatusFailed'));
        setInstallMsgType('error');
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
        return;
      }
      setUser(data);
    } catch {
      setInstallMsg(t('home.checkStatusFailed'));
      setInstallMsgType('error');
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const logsRepoParam = params.get('logsRepo');
    if (logsRepoParam) {
      setLogsRepo(logsRepoParam);
      setActivePage('logs');
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const install = params.get('install');
    if (install === 'success') {
      setInstallMsg(t('home.installSuccess'));
      setInstallMsgType('success');
    } else if (install === 'error') {
      setInstallMsg(t('home.installError'));
      setInstallMsgType('error');
    }
    if (install) window.history.replaceState({}, '', '/dashboard');
  }, [user, t]);

  const checkAppConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/github/install');
      setAppConfigured(res.status !== 500);
    } catch {
      logger.error('Failed to check app configuration');
      setAppConfigured(false);
    }
  }, []);

  const loadRepos = useCallback(async () => {
    setReposLoading(true);
    try {
      const res = await fetch('/api/github/repos');
      if (res.ok) setRepos(await res.json());
    } catch {
      setInstallMsg(t('home.checkStatusFailed'));
      setInstallMsgType('error');
    } finally {
      setReposLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (user) {
      checkAppConfig();
      loadRepos();
    }
  }, [user, checkAppConfig, loadRepos]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      logger.error('Logout request failed, redirecting anyway');
    }
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-50 flex overflow-hidden">
      <Sidebar
        activePage={activePage}
        onNavigate={(page) => {
          setActivePage(page);
          setLogsRepo(null);
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        userLogin={user?.githubLogin || ''}
        onLogout={handleLogout}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 sm:p-8 max-w-5xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {user?.avatarUrl && (
                <Image
                  src={user.avatarUrl}
                  alt={user.githubLogin}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full ring-2 ring-zinc-200"
                  unoptimized
                />
              )}
              <div>
                <h1 className="text-xl font-bold text-zinc-900">
                  {activePage === 'overview' && t('home.dashboard')}
                  {activePage === 'repos' && t('sidebar.repos')}
                  {activePage === 'logs' && t('sidebar.logs')}
                  {activePage === 'env' && t('sidebar.envVars')}
                  {activePage === 'apikeys' && t('sidebar.apiKeys')}
                  {activePage === 'settings' && t('sidebar.settings')}
                </h1>
                <p className="text-zinc-500 text-xs">@{user?.githubLogin}</p>
              </div>
            </div>
            {activePage === 'repos' && (
              <Button
                variant="ghost"
                size="sm"
                icon={<RefreshCw className={`h-3.5 w-3.5 ${reposLoading ? 'animate-spin' : ''}`} />}
                onClick={loadRepos}
                className="text-zinc-500 hover:text-zinc-700"
              >
                {t('dashboard.refresh')}
              </Button>
            )}
          </div>

          {installMsg && (
            <div
              className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                installMsgType === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {installMsgType === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              {installMsg}
            </div>
          )}

          {activePage === 'overview' && (
            <OverviewPage
              repos={repos}
              reposLoading={reposLoading}
              appConfigured={appConfigured}
              onInstall={() => (window.location.href = '/api/github/install')}
              onNavigateToRepos={() => setActivePage('repos')}
              onNavigateToEnv={() => setActivePage('env')}
            />
          )}
          {activePage === 'repos' && <ReposPage repos={repos} reposLoading={reposLoading} />}
          {activePage === 'logs' && <WorkflowLogsPage initialRepo={logsRepo} />}
          {activePage === 'env' && <EnvVarsPage />}
          {activePage === 'apikeys' && <ApiKeyPage />}
          {activePage === 'settings' && <SettingsPage />}
        </div>
      </div>
    </div>
  );
}
