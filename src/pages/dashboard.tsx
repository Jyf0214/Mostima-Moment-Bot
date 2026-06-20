'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ProCard } from '@/components/ui/ProCard';
import { PageContainer } from '@/components/ui/PageContainer';
import { LogOut, Settings, Activity } from 'lucide-react';

interface User {
  githubId: number;
  githubLogin: string;
  avatarUrl: string;
  isAdmin: boolean;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (!data.user) {
        window.location.href = '/';
        return;
      }
      setUser(data.user);
    } catch {
      window.location.href = '/';
    } finally {
      setLoading(false);
    }
  };

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <PageContainer maxWidth="5xl" padding="default">
        <div className="py-12">
          {/* Header */}
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              {user?.avatarUrl && (
                <img src={user.avatarUrl} alt="" className="h-12 w-12 rounded-full" />
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

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <ProCard className="bg-white/5 backdrop-blur-xl border-white/10" padding="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-white/40 text-sm">{t('home.roleAdmin')}</p>
                  <p className="text-white font-semibold">
                    {user?.isAdmin ? t('home.roleAdmin') : t('home.roleUser')}
                  </p>
                </div>
              </div>
            </ProCard>

            <ProCard className="bg-white/5 backdrop-blur-xl border-white/10" padding="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Settings className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-white/40 text-sm">Status</p>
                  <p className="text-white font-semibold">Online</p>
                </div>
              </div>
            </ProCard>

            <ProCard className="bg-white/5 backdrop-blur-xl border-white/10" padding="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-white/40 text-sm">Builds</p>
                  <p className="text-white font-semibold">0</p>
                </div>
              </div>
            </ProCard>
          </div>

          {/* Placeholder */}
          <ProCard className="bg-white/5 backdrop-blur-xl border-white/10" padding="p-8">
            <div className="text-center py-12">
              <p className="text-white/40">{t('home.subtitle')}</p>
            </div>
          </ProCard>
        </div>
      </PageContainer>
    </div>
  );
}
