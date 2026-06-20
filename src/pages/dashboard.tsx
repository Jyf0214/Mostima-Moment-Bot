'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ProCard } from '@/components/ui/ProCard';
import Sidebar, { type SidebarPage } from '@/components/dashboard/Sidebar';
import EnvVarsPage from '@/components/dashboard/EnvVarsPage';
import {
  LogOut,
  Plug,
  FolderGit2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Lock,
  Globe,
  BarChart3,
  Settings,
} from 'lucide-react';

interface User {
  githubId: number;
  githubLogin: string;
  avatarUrl: string;
  isAdmin: boolean;
}

interface Installation {
  installationId: number;
  accountLogin: string;
  accountType: string;
  avatarUrl: string | null;
  createdAt: string;
}

interface Repo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
  updated_at: string;
}

interface ReposData {
  personal: Repo[];
  organization: Repo[];
  installations: Installation[];
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState<SidebarPage>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [repos, setRepos] = useState<ReposData | null>(null);
  const [reposLoading, setReposLoading] = useState(false);
  const [appConfigured, setAppConfigured] = useState<boolean | null>(null);
  const [installMsg, setInstallMsg] = useState<string | null>(null);
  const [installMsgType, setInstallMsgType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    checkAuth();
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
    if (install) {
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [user]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        window.location.href = '/';
        return;
      }
      const data = await response.json();
      if (!data.githubId) {
        window.location.href = '/';
        return;
      }
      setUser(data);
    } catch {
      window.location.href = '/';
    } finally {
      setLoading(false);
    }
  };

  const checkAppConfig = async () => {
    try {
      const res = await fetch('/api/github/install');
      setAppConfigured(res.status !== 500);
    } catch {
      setAppConfigured(false);
    }
  };

  const loadRepos = async () => {
    setReposLoading(true);
    try {
      const res = await fetch('/api/github/repos');
      if (res.ok) {
        setRepos(await res.json());
      }
    } catch {
      // 静默处理
    } finally {
      setReposLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkAppConfig();
      loadRepos();
    }
  }, [user]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
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
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-10 w-10 rounded-full ring-2 ring-white/10"
                />
              )}
              <div>
                <h1 className="text-xl font-bold text-white">
                  {activePage === 'overview' && t('home.dashboard')}
                  {activePage === 'repos' && t('sidebar.repos')}
                  {activePage === 'env' && t('sidebar.envVars')}
                  {activePage === 'settings' && t('sidebar.settings')}
                </h1>
                <p className="text-white/40 text-xs">@{user?.githubLogin}</p>
              </div>
            </div>
            {activePage === 'repos' && (
              <Button
                variant="ghost"
                size="sm"
                icon={<RefreshCw className={`h-3.5 w-3.5 ${reposLoading ? 'animate-spin' : ''}`} />}
                onClick={loadRepos}
                className="text-white/50 hover:text-white"
              >
                {t('dashboard.refresh')}
              </Button>
            )}
          </div>

          {installMsg && (
            <div
              className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                installMsgType === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-red-500/30 bg-red-500/10 text-red-400'
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
          {activePage === 'env' && <EnvVarsPage />}
          {activePage === 'settings' && <SettingsPage />}
        </div>
      </div>
    </div>
  );
}

function OverviewPage({
  repos,
  reposLoading,
  appConfigured,
  onInstall,
  onNavigateToRepos,
  onNavigateToEnv,
}: {
  repos: ReposData | null;
  reposLoading: boolean;
  appConfigured: boolean | null;
  onInstall: () => void;
  onNavigateToRepos: () => void;
  onNavigateToEnv: () => void;
}) {
  const { t } = useTranslation();
  const hasInstallations = repos && repos.installations.length > 0;
  const totalRepos = repos ? repos.personal.length + repos.organization.length : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <ProCard className="bg-white/5 backdrop-blur-xl border-white/10" padding="p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Plug className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <p className="text-white/40 text-xs">{t('dashboard.activeInstallations')}</p>
              <p className="text-xl font-bold text-white">
                {reposLoading ? '...' : repos?.installations.length || 0}
              </p>
            </div>
          </div>
        </ProCard>
        <ProCard className="bg-white/5 backdrop-blur-xl border-white/10" padding="p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FolderGit2 className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <p className="text-white/40 text-xs">{t('dashboard.totalRepos')}</p>
              <p className="text-xl font-bold text-white">{reposLoading ? '...' : totalRepos}</p>
            </div>
          </div>
        </ProCard>
        <ProCard className="bg-white/5 backdrop-blur-xl border-white/10" padding="p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-white/40 text-xs">{t('envPage.configured')}</p>
              <p className="text-xl font-bold text-white">
                {appConfigured === null ? '...' : appConfigured ? '✓' : '—'}
              </p>
            </div>
          </div>
        </ProCard>
      </div>

      <ProCard className="bg-white/5 backdrop-blur-xl border-white/10" padding="p-5">
        <h3 className="text-sm font-medium text-white/60 mb-4">{t('dashboard.quickActions')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!hasInstallations && appConfigured !== false ? (
            <button
              onClick={onInstall}
              className="flex items-center gap-3 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all text-left"
            >
              <Plug className="h-5 w-5 text-purple-400 shrink-0" />
              <div>
                <p className="text-white text-sm font-medium">{t('home.installApp')}</p>
                <p className="text-white/40 text-xs">{t('home.installAppDesc')}</p>
              </div>
            </button>
          ) : (
            <button
              onClick={onNavigateToRepos}
              className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all text-left"
            >
              <FolderGit2 className="h-5 w-5 text-blue-400 shrink-0" />
              <div>
                <p className="text-white text-sm font-medium">{t('home.repositories')}</p>
                <p className="text-white/40 text-xs">
                  {totalRepos} {t('home.repositories')}
                </p>
              </div>
            </button>
          )}
          <button
            onClick={onNavigateToEnv}
            className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all text-left"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-white text-sm font-medium">{t('sidebar.envVars')}</p>
              <p className="text-white/40 text-xs">{t('envPage.subtitle')}</p>
            </div>
          </button>
        </div>
      </ProCard>
    </div>
  );
}

function ReposPage({ repos, reposLoading }: { repos: ReposData | null; reposLoading: boolean }) {
  const { t } = useTranslation();
  const hasInstallations = repos && repos.installations.length > 0;

  if (reposLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-white/20 border-t-purple-500" />
      </div>
    );
  }

  if (!hasInstallations) {
    return (
      <ProCard className="bg-white/5 backdrop-blur-xl border-white/10 border-dashed" padding="p-8">
        <div className="text-center">
          <Plug className="h-10 w-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm mb-4">{t('home.noInstallations')}</p>
          <Button
            variant="primary"
            size="md"
            icon={<Plug className="h-4 w-4" />}
            onClick={() => (window.location.href = '/api/github/install')}
          >
            {t('home.installAppButton')}
          </Button>
        </div>
      </ProCard>
    );
  }

  const totalRepos = (repos?.personal.length || 0) + (repos?.organization.length || 0);

  if (totalRepos === 0) {
    return (
      <ProCard className="bg-white/5 backdrop-blur-xl border-white/10" padding="p-8">
        <div className="text-center">
          <FolderGit2 className="h-10 w-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm">{t('home.noRepos')}</p>
        </div>
      </ProCard>
    );
  }

  return (
    <div className="space-y-6">
      {repos!.personal.length > 0 && (
        <RepoSection title={t('home.personalRepos')} repos={repos!.personal} />
      )}
      {repos!.organization.length > 0 && (
        <RepoSection title={t('home.orgRepos')} repos={repos!.organization} />
      )}
    </div>
  );
}

function RepoSection({ title, repos }: { title: string; repos: Repo[] }) {
  const { t } = useTranslation();
  return (
    <div>
      <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
        <FolderGit2 className="h-4 w-4" />
        {title}
        <span className="text-white/30">({repos.length})</span>
      </h3>
      <div className="space-y-2">
        {repos.map((repo) => (
          <ProCard
            key={repo.id}
            className="bg-white/5 backdrop-blur-xl border-white/10 hover:border-white/20 transition-all"
            padding="p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white font-medium text-sm hover:text-purple-400 transition-colors truncate"
                  >
                    {repo.name}
                  </a>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      repo.private
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-emerald-500/10 text-emerald-400'
                    }`}
                  >
                    {repo.private ? (
                      <Lock className="h-2.5 w-2.5" />
                    ) : (
                      <Globe className="h-2.5 w-2.5" />
                    )}
                    {repo.private ? t('home.repoPrivate') : t('home.repoPublic')}
                  </span>
                </div>
                {repo.description && (
                  <p className="text-white/40 text-xs truncate">{repo.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {repo.language && <span className="text-white/30 text-xs">{repo.language}</span>}
                <a
                  href={repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/30 hover:text-white/60 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </ProCard>
        ))}
      </div>
    </div>
  );
}

function SettingsPage() {
  const { t } = useTranslation();
  return (
    <ProCard className="bg-white/5 backdrop-blur-xl border-white/10" padding="p-8">
      <div className="text-center">
        <Settings className="h-10 w-10 text-white/20 mx-auto mb-3" />
        <p className="text-white/40 text-sm">{t('sidebar.settings')}</p>
      </div>
    </ProCard>
  );
}
