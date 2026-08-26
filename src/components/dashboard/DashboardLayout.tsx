'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { logger } from '@/lib/logger';
import { apiJson, redirectToHome } from '@/lib/api-client';
import { AlertTriangle } from 'lucide-react';
import Sidebar, { type SidebarPage } from './Sidebar';
import type { User } from './types';

/** 鉴权失败提示的停留时长，之后整页跳回首页（需清除全部客户端登录态） */
const AUTH_REDIRECT_DELAY_MS = 1500;

interface DashboardLayoutProps {
  activePage: SidebarPage;
  children: React.ReactNode;
  /** 渲染在页头右侧的操作区（如刷新按钮） */
  headerAction?: React.ReactNode;
  /** 鉴权成功后回调用户信息；内部用 ref 持有，无需保证引用稳定 */
  onUserLoaded?: (user: User) => void;
}

export default function DashboardLayout({
  activePage,
  children,
  headerAction,
  onUserLoaded,
}: DashboardLayoutProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authFailed, setAuthFailed] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUserLoadedRef = useRef(onUserLoaded);

  // ref 不能在渲染期写入，改为每次提交后同步最新回调
  useEffect(() => {
    onUserLoadedRef.current = onUserLoaded;
  });

  useEffect(
    () => () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    },
    []
  );

  // 统一的鉴权失败处理：显示提示横幅，短暂停留后跳回首页
  const scheduleHomeRedirect = useCallback(() => {
    setAuthFailed(true);
    setLoading(false);
    redirectTimerRef.current = setTimeout(() => {
      redirectToHome();
    }, AUTH_REDIRECT_DELAY_MS);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const data = await apiJson<User>('/api/auth/me');
        if (cancelled) return;
        if (!data.githubId) {
          scheduleHomeRedirect();
          return;
        }
        setUser(data);
        onUserLoadedRef.current?.(data);
      } catch (err) {
        logger.error('Auth check failed:', err);
        if (!cancelled) scheduleHomeRedirect();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void checkAuth();
    return () => {
      cancelled = true;
    };
  }, [scheduleHomeRedirect]);
  // 登出进行中：禁用侧边栏登出入口，防止慢网络下连点发出多份请求且无任何反馈
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      logger.error('Logout request failed, redirecting anyway');
    }
    redirectToHome();
  };

  const handleNavigate = (page: SidebarPage) => {
    if (page === 'overview') {
      router.push('/dashboard', undefined, { shallow: true });
    } else {
      router.push({ pathname: '/dashboard', query: { page } }, undefined, { shallow: true });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-500" />
      </div>
    );
  }

  if (authFailed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {t('auth.checkFailedRedirecting')}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-50 flex overflow-hidden">
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        userLogin={user?.githubLogin || ''}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 sm:p-8 max-w-5xl">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3 min-w-0">
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
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-zinc-900 truncate">
                  {activePage === 'overview' && t('home.dashboard')}
                  {activePage === 'repos' && t('sidebar.repos')}
                  {activePage === 'logs' && t('sidebar.logs')}
                  {activePage === 'runners' && t('sidebar.runners')}
                  {activePage === 'env' && t('sidebar.envVars')}
                  {activePage === 'apikeys' && t('sidebar.apiKeys')}
                  {activePage === 'settings' && t('sidebar.settings')}
                </h1>
                <p className="text-zinc-500 text-xs truncate">@{user?.githubLogin}</p>
              </div>
            </div>
            {headerAction && <div className="shrink-0">{headerAction}</div>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
