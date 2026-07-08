'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import SettingsPage from '@/components/dashboard/SettingsPage';

export default function SettingsRoutePage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
      } catch {
        logger.error('Auth check failed');
        window.location.href = '/';
        return;
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <SettingsPage />
      </div>
    </div>
  );
}
