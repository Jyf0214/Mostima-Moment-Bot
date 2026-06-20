'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ProCard } from '@/components/ui/ProCard';
import { PageContainer } from '@/components/ui/PageContainer';
import {
  ArrowLeft,
  ExternalLink,
  Lock,
  Globe,
  Settings,
  Clock,
  GitBranch,
  Shield,
} from 'lucide-react';

export default function RepoDetailPage() {
  const { t } = useTranslation();
  const [repoName, setRepoName] = useState('');
  const [repoId, setRepoId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRepoName(params.get('name') || '');
    setRepoId(params.get('repoId') || '');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <PageContainer maxWidth="5xl" padding="default">
        <div className="py-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => (window.location.href = '/dashboard')}
              className="text-white/50 hover:text-white"
            >
              {t('repoDetail.back')}
            </Button>
          </div>

          {/* Repo Info */}
          <ProCard className="bg-white/5 backdrop-blur-xl border-white/10 mb-6" padding="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <GitBranch className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">{repoName || 'Repository'}</h1>
                  <p className="text-white/40 text-xs">ID: {repoId}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<ExternalLink className="h-3.5 w-3.5" />}
                onClick={() => window.open(`https://github.com/${repoName}`, '_blank')}
                className="text-white/50 hover:text-white"
              >
                GitHub
              </Button>
            </div>
          </ProCard>

          {/* CI/CD 配置 - TODO */}
          <ProCard
            className="bg-white/5 backdrop-blur-xl border-white/10 border-dashed mb-6"
            padding="p-8"
          >
            <div className="text-center">
              <Settings className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">{t('repoDetail.cicdConfig')}</h3>
              <p className="text-white/40 text-sm mb-4">{t('repoDetail.cicdConfigDesc')}</p>
              <div className="flex items-center justify-center gap-2 text-white/30 text-xs">
                <Clock className="h-3.5 w-3.5" />
                <span>{t('repoDetail.todo')}</span>
              </div>
            </div>
          </ProCard>

          {/* 触发规则 - TODO */}
          <ProCard
            className="bg-white/5 backdrop-blur-xl border-white/10 border-dashed mb-6"
            padding="p-8"
          >
            <div className="text-center">
              <GitBranch className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">{t('repoDetail.triggerRules')}</h3>
              <p className="text-white/40 text-sm mb-4">{t('repoDetail.triggerRulesDesc')}</p>
              <div className="flex items-center justify-center gap-2 text-white/30 text-xs">
                <Clock className="h-3.5 w-3.5" />
                <span>{t('repoDetail.todo')}</span>
              </div>
            </div>
          </ProCard>

          {/* Webhook 配置 - TODO */}
          <ProCard
            className="bg-white/5 backdrop-blur-xl border-white/10 border-dashed"
            padding="p-8"
          >
            <div className="text-center">
              <Shield className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">{t('repoDetail.webhookConfig')}</h3>
              <p className="text-white/40 text-sm mb-4">{t('repoDetail.webhookConfigDesc')}</p>
              <div className="flex items-center justify-center gap-2 text-white/30 text-xs">
                <Clock className="h-3.5 w-3.5" />
                <span>{t('repoDetail.todo')}</span>
              </div>
            </div>
          </ProCard>
        </div>
      </PageContainer>
    </div>
  );
}
