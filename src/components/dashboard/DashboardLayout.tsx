'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { logger } from '@/lib/logger';
import Sidebar, { type SidebarPage } from './Sidebar';
import type { User } from './types';

interface DashboardLayoutProps {
  activePage: SidebarPage;
  children: React.ReactNode;
}

export default function DashboardLayout({ activePage, children }: DashboardLayoutProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const checkAuth = useCallback(async () => {
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
      logger.error('Auth check failed');
      window.location.href = '/';
      return;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      logger.error('Logout request failed');
    }
    window.location.href = '/';
  };

  const handleNavigate = (page: SidebarPage) => {
    if (page === 'overview') {
      router.push('/dashboard', undefined, { shallow: true });
    } else {
      router.push(`/dashboard/${page}`, undefined, { shallow: true });
    }
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
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        userLogin={user?.githubLogin || ''}
        onLogout={handleLogout}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 sm:p-8 max-w-5xl">
          <div className="flex items-center gap-3 mb-6">
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
                {activePage === 'runners' && t('sidebar.runners')}
                {activePage === 'env' && t('sidebar.envVars')}
                {activePage === 'apikeys' && t('sidebar.apiKeys')}
                {activePage === 'settings' && t('sidebar.settings')}
              </h1>
              <p className="text-zinc-500 text-xs">@{user?.githubLogin}</p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
