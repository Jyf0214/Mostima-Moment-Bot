'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ProCard } from '@/components/ui/ProCard';
import Sidebar, { type SidebarPage } from '@/components/dashboard/Sidebar';
import EnvVarsPage from '@/components/dashboard/EnvVarsPage';
import WorkflowLogsPage from '@/components/dashboard/WorkflowLogsPage';
import ApiKeyPage from '@/components/dashboard/ApiKeyPage';
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
  Search,
  X,
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
  enabled: boolean;
  owner: {
    login: string;
    type: string;
    avatar_url: string;
  };
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
  const [logsRepo, setLogsRepo] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [repos, setRepos] = useState<ReposData | null>(null);
  const [reposLoading, setReposLoading] = useState(false);
  const [appConfigured, setAppConfigured] = useState<boolean | null>(null);
  const [installMsg, setInstallMsg] = useState<string | null>(null);
  const [installMsgType, setInstallMsgType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    checkAuth();
  }, []);

  // 挂载时读取 logsRepo 参数（不依赖 auth）
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
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-10 w-10 rounded-full ring-2 ring-zinc-200"
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

function ReposPage({ repos, reposLoading }: { repos: ReposData | null; reposLoading: boolean }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const hasInstallations = repos && repos.installations.length > 0;

  if (reposLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-zinc-200 border-t-blue-500" />
      </div>
    );
  }

  if (!hasInstallations) {
    return (
      <ProCard className="bg-white border-zinc-200 border-dashed" padding="p-8">
        <div className="text-center">
          <Plug className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm mb-4">{t('home.noInstallations')}</p>
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
      <ProCard className="bg-white border-zinc-200" padding="p-8">
        <div className="text-center">
          <FolderGit2 className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">{t('home.noRepos')}</p>
        </div>
      </ProCard>
    );
  }

  // 过滤仓库
  const query = searchQuery.toLowerCase().trim();
  const filterRepos = (list: Repo[]) =>
    query
      ? list.filter(
          (r) =>
            r.name.toLowerCase().includes(query) ||
            r.full_name.toLowerCase().includes(query) ||
            (r.description && r.description.toLowerCase().includes(query))
        )
      : list;

  const filteredPersonal = filterRepos(repos!.personal);
  const filteredOrg = filterRepos(repos!.organization);
  const filteredTotal = filteredPersonal.length + filteredOrg.length;

  return (
    <div className="space-y-4">
      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('dashboard.searchRepos')}
          className="w-full h-10 pl-10 pr-10 rounded-xl bg-white border border-zinc-200 text-zinc-700 text-sm placeholder:text-zinc-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 搜索结果统计 */}
      {query && (
        <p className="text-zinc-400 text-xs">
          {filteredTotal === 0
            ? t('dashboard.noResults')
            : t('dashboard.searchResults', { count: String(filteredTotal) })}
        </p>
      )}

      {/* 仓库列表 */}
      <div className="space-y-6">
        {filteredPersonal.length > 0 && (
          <RepoSection title={t('home.personalRepos')} repos={filteredPersonal} />
        )}
        {filteredOrg.length > 0 && <RepoSection title={t('home.orgRepos')} repos={filteredOrg} />}
        {query && filteredTotal === 0 && (
          <ProCard className="bg-white border-zinc-200" padding="p-8">
            <div className="text-center">
              <Search className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">{t('dashboard.noResults')}</p>
            </div>
          </ProCard>
        )}
      </div>
    </div>
  );
}

function RepoSection({ title, repos }: { title: string; repos: Repo[] }) {
  const { t } = useTranslation();
  const [toggleStates, setToggleStates] = useState<Record<number, boolean>>({});

  // 初始化开关状态
  useEffect(() => {
    const states: Record<number, boolean> = {};
    repos.forEach((r) => {
      states[r.id] = r.enabled;
    });
    setToggleStates(states);
  }, [repos]);

  const handleToggle = async (repo: Repo) => {
    const newState = !toggleStates[repo.id];
    // 乐观更新
    setToggleStates((prev) => ({ ...prev, [repo.id]: newState }));

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
        // 回滚
        setToggleStates((prev) => ({ ...prev, [repo.id]: !newState }));
      }
    } catch {
      setToggleStates((prev) => ({ ...prev, [repo.id]: !newState }));
    }
  };

  const handleDetail = (repo: Repo) => {
    window.location.href = `/dashboard/repo?repoId=${repo.id}&name=${encodeURIComponent(repo.full_name)}`;
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-zinc-500 mb-3 flex items-center gap-2">
        <FolderGit2 className="h-4 w-4" />
        {title}
        <span className="text-zinc-400">({repos.length})</span>
      </h3>
      <div className="space-y-2">
        {repos.map((repo) => (
          <ProCard
            key={repo.id}
            className="bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-md transition-all"
            padding="p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <button
                    onClick={() => handleDetail(repo)}
                    className="text-zinc-900 font-medium text-sm hover:text-blue-600 transition-colors truncate text-left"
                  >
                    {repo.name}
                  </button>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      repo.private ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
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
                  <p className="text-zinc-500 text-xs truncate">{repo.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {repo.language && <span className="text-zinc-400 text-xs">{repo.language}</span>}
                <a
                  href={repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                {/* Toggle switch */}
                <button
                  role="switch"
                  aria-checked={toggleStates[repo.id] ?? false}
                  onClick={() => handleToggle(repo)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                    toggleStates[repo.id] ? 'bg-blue-500' : 'bg-zinc-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      toggleStates[repo.id] ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
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
  const [privateKeyStatus, setPrivateKeyStatus] = useState<{
    configured: boolean;
    source: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadMsgType, setUploadMsgType] = useState<'success' | 'error'>('success');
  const [botInfo, setBotInfo] = useState<{
    slug: string;
    appId: string;
    mention: string;
    fixCommand: string;
    installUrl: string;
  } | null>(null);

  useEffect(() => {
    checkPrivateKey();
    fetchBotInfo();
  }, []);

  const checkPrivateKey = async () => {
    try {
      const res = await fetch('/api/github/private-key');
      if (res.ok) {
        setPrivateKeyStatus(await res.json());
      }
    } catch {
      setPrivateKeyStatus({ configured: false, source: 'none' });
    }
  };

  const fetchBotInfo = async () => {
    try {
      const res = await fetch('/api/bot/info');
      if (res.ok) {
        setBotInfo(await res.json());
      }
    } catch {
      // 静默处理
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadMsg(null);

    try {
      const content = await file.text();
      const res = await fetch('/api/github/private-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privateKey: content }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUploadMsg(t('settings.configSaved'));
        setUploadMsgType('success');
        checkPrivateKey();
      } else {
        setUploadMsg(data.error || t('settings.setupFailed'));
        setUploadMsgType('error');
      }
    } catch (err) {
      setUploadMsg(err instanceof Error ? err.message : t('settings.setupFailed'));
      setUploadMsgType('error');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.pem')) {
      handleFileUpload(file);
    } else {
      setUploadMsg('Please select a .pem file');
      setUploadMsgType('error');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  return (
    <div className="space-y-4">
      {/* 机器人信息 */}
      {botInfo && botInfo.slug && (
        <ProCard className="bg-white border-zinc-200" padding="p-5">
          <div className="flex items-center gap-3 mb-4">
            <Plug className="h-5 w-5 text-zinc-500" />
            <h3 className="text-zinc-900 font-medium">{t('settings.botInfo')}</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-sm">{t('settings.botSlug')}</span>
              <span className="text-zinc-900 text-sm font-mono">{botInfo.slug}</span>
            </div>
            {botInfo.appId && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 text-sm">{t('settings.botAppId')}</span>
                <span className="text-zinc-900 text-sm font-mono">{botInfo.appId}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-sm">{t('settings.botMention')}</span>
              <code className="text-blue-600 text-sm bg-blue-50 px-2 py-0.5 rounded">
                {botInfo.fixCommand}
              </code>
            </div>
            {botInfo.installUrl && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 text-sm">{t('settings.botInstall')}</span>
                <a
                  href={botInfo.installUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 text-sm hover:text-blue-700 transition-colors"
                >
                  {t('home.installAppButton')} ↗
                </a>
              </div>
            )}
          </div>
        </ProCard>
      )}

      {/* 私钥配置状态 */}
      <ProCard className="bg-white border-zinc-200" padding="p-5">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="h-5 w-5 text-zinc-500" />
          <h3 className="text-zinc-900 font-medium">{t('setup.privateKey')}</h3>
        </div>

        {privateKeyStatus && (
          <div className="mb-4">
            <div className="flex items-center gap-2">
              {privateKeyStatus.configured ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              <span className="text-sm text-zinc-600">
                {privateKeyStatus.configured
                  ? `${t('settings.configured')} (${privateKeyStatus.source === 'file' ? 'File' : 'Database'})`
                  : t('settings.missingLabel')}
              </span>
            </div>
          </div>
        )}

        {/* 上传区域 */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-zinc-200 rounded-xl p-6 text-center hover:border-blue-300 transition-colors cursor-pointer"
          onClick={() => document.getElementById('pem-file-input')?.click()}
        >
          <Lock className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-zinc-500 text-sm mb-2">{t('setup.privateKeyPlaceholder')}</p>
          <p className="text-zinc-400 text-xs">.pem</p>
          <input
            id="pem-file-input"
            type="file"
            accept=".pem"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {uploading && (
          <div className="mt-3 flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <span className="text-xs text-zinc-500">Uploading...</span>
          </div>
        )}

        {uploadMsg && (
          <div
            className={`mt-3 text-xs px-3 py-2 rounded-lg ${
              uploadMsgType === 'success'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {uploadMsg}
          </div>
        )}
      </ProCard>

      {/* App ID 配置提示 */}
      <ProCard className="bg-white border-zinc-200" padding="p-5">
        <div className="flex items-center gap-3 mb-3">
          <Settings className="h-5 w-5 text-blue-500" />
          <h3 className="text-zinc-900 font-medium">GitHub App</h3>
        </div>
        <p className="text-zinc-500 text-xs">
          {process.env.GITHUB_APP_ID
            ? `GITHUB_APP_ID: ${process.env.GITHUB_APP_ID}`
            : 'GITHUB_APP_ID not set in environment variables'}
        </p>
      </ProCard>
    </div>
  );
}
