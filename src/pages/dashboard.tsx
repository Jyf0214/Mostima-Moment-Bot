'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { ProCard } from '@/components/ui/ProCard';
import {
  LogOut,
  Plug,
  FolderGit2,
  Lock,
  Globe,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
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
  const [repos, setRepos] = useState<ReposData | null>(null);
  const [reposLoading, setReposLoading] = useState(false);
  const [appConfigured, setAppConfigured] = useState<boolean | null>(null);
  const [installMsg, setInstallMsg] = useState<string | null>(null);
  const [installMsgType, setInstallMsgType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    // 检查 URL 参数中的安装结果
    const params = new URLSearchParams(window.location.search);
    const install = params.get('install');
    if (install === 'success') {
      setInstallMsg(t('home.installSuccess'));
      setInstallMsgType('success');
      loadRepos();
    } else if (install === 'error') {
      setInstallMsg(t('home.installError'));
      setInstallMsgType('error');
    }
    // 清除 URL 参数
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
      // 如果返回 500 且包含 not configured，说明未配置
      if (res.status === 500) {
        setAppConfigured(false);
      } else {
        setAppConfigured(true);
      }
    } catch {
      setAppConfigured(false);
    }
  };

  const loadRepos = async () => {
    setReposLoading(true);
    try {
      const res = await fetch('/api/github/repos');
      if (res.ok) {
        const data = await res.json();
        setRepos(data);
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

  const handleInstall = () => {
    window.location.href = '/api/github/install';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-purple-500" />
      </div>
    );
  }

  const hasInstallations = repos && repos.installations.length > 0;
  const totalRepos = repos ? repos.personal.length + repos.organization.length : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <PageContainer maxWidth="6xl" padding="default">
        <div className="py-8 sm:py-12">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              {user?.avatarUrl && (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-12 w-12 rounded-full ring-2 ring-white/10"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-white">{t('home.dashboard')}</h1>
                <p className="text-white/50 text-sm">@{user?.githubLogin}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<LogOut className="h-4 w-4" />}
              onClick={handleLogout}
              className="text-white/60 hover:text-white"
            >
              {t('home.logout')}
            </Button>
          </div>

          {/* 安装结果提示 */}
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

          {/* GitHub App 安装区域 */}
          {appConfigured === false ? (
            <ProCard className="bg-white/5 backdrop-blur-xl border-white/10 mb-6" padding="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">{t('home.appNotConfigured')}</h3>
                  <p className="text-white/40 text-sm">{t('home.appNotConfiguredDesc')}</p>
                </div>
              </div>
            </ProCard>
          ) : !hasInstallations ? (
            <ProCard
              className="bg-white/5 backdrop-blur-xl border-white/10 border-dashed mb-6"
              padding="p-8"
            >
              <div className="text-center">
                <div className="h-14 w-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                  <Plug className="h-7 w-7 text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {t('home.noInstallations')}
                </h3>
                <p className="text-white/40 text-sm mb-6 max-w-md mx-auto">
                  {t('home.noInstallationsDesc')}
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  icon={<Plug className="h-4 w-4" />}
                  onClick={handleInstall}
                >
                  {t('home.installAppButton')}
                </Button>
              </div>
            </ProCard>
          ) : (
            <>
              {/* 已安装账户信息 */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  {t('home.installApp')}
                </h2>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={
                      <RefreshCw className={`h-3.5 w-3.5 ${reposLoading ? 'animate-spin' : ''}`} />
                    }
                    onClick={loadRepos}
                    className="text-white/50 hover:text-white"
                  >
                    {t('dashboard.refresh')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Plug className="h-3.5 w-3.5" />}
                    onClick={handleInstall}
                    className="text-white/50 hover:text-white"
                  >
                    {t('home.installApp')}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                {repos.installations.map((inst) => (
                  <ProCard
                    key={inst.installationId}
                    className="bg-white/5 backdrop-blur-xl border-white/10"
                    padding="p-4"
                  >
                    <div className="flex items-center gap-3">
                      {inst.avatarUrl ? (
                        <img src={inst.avatarUrl} alt="" className="h-10 w-10 rounded-lg" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                          <Plug className="h-5 w-5 text-white/50" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-white font-medium text-sm truncate">
                          {inst.accountLogin}
                        </p>
                        <p className="text-white/40 text-xs">{inst.accountType}</p>
                      </div>
                    </div>
                  </ProCard>
                ))}
              </div>

              {/* 仓库列表 */}
              {reposLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-white/20 border-t-purple-500" />
                </div>
              ) : totalRepos === 0 ? (
                <ProCard className="bg-white/5 backdrop-blur-xl border-white/10" padding="p-8">
                  <div className="text-center">
                    <FolderGit2 className="h-10 w-10 text-white/20 mx-auto mb-3" />
                    <p className="text-white/40 text-sm">{t('home.noRepos')}</p>
                  </div>
                </ProCard>
              ) : (
                <div className="space-y-6">
                  {/* 个人仓库 */}
                  {repos.personal.length > 0 && (
                    <RepoSection
                      title={t('home.personalRepos')}
                      repos={repos.personal}
                      count={repos.personal.length}
                    />
                  )}
                  {/* 组织仓库 */}
                  {repos.organization.length > 0 && (
                    <RepoSection
                      title={t('home.orgRepos')}
                      repos={repos.organization}
                      count={repos.organization.length}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </PageContainer>
    </div>
  );
}

function RepoSection({ title, repos, count }: { title: string; repos: Repo[]; count: number }) {
  const { t } = useTranslation();

  return (
    <div>
      <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
        <FolderGit2 className="h-4 w-4" />
        {title}
        <span className="text-white/30">({count})</span>
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
