'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProCard } from '@/components/ui/ProCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Shield,
  ChevronDown,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';

interface EnvVarDetail {
  key: string;
  category: string;
  required: boolean;
  configured: boolean;
  description: string;
  usage: string;
  hint: string;
}

interface EnvGroup {
  name: string;
  description: string;
  vars: EnvVarDetail[];
}

export default function EnvVarsPage() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<EnvGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedVar, setExpandedVar] = useState<string | null>(null);

  useEffect(() => {
    loadEnvStatus();
  }, []);

  const loadEnvStatus = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/env-status');
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups);
      } else {
        setLoadError(t('envPage.loadFailed'));
      }
    } catch {
      setLoadError(t('envPage.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const allVars = groups.flatMap((g) => g.vars);
  const configuredCount = allVars.filter((v) => v.configured).length;
  const totalCount = allVars.length;

  const filteredGroups = groups
    .map((g) => ({
      ...g,
      vars: g.vars.filter(
        (v) =>
          v.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.usage.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((g) => g.vars.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-zinc-200 border-t-blue-500" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
              <Shield className="h-5 w-5 text-zinc-500" />
              {t('envPage.title')}
            </h2>
            <p className="text-zinc-500 text-sm mt-1">{t('envPage.subtitle')}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={loadEnvStatus}
            className="text-zinc-500 hover:text-zinc-700"
          >
            {t('dashboard.refresh')}
          </Button>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {loadError}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Shield className="h-5 w-5 text-zinc-500" />
            {t('envPage.title')}
          </h2>
          <p className="text-zinc-500 text-sm mt-1">{t('envPage.subtitle')}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />}
          onClick={loadEnvStatus}
          className="text-zinc-500 hover:text-zinc-700"
        >
          {t('dashboard.refresh')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <ProCard className="bg-white border-zinc-200" padding="p-4">
          <p className="text-zinc-500 text-xs mb-1">{t('envPage.totalVars')}</p>
          <p className="text-2xl font-bold text-zinc-900">{totalCount}</p>
        </ProCard>
        <ProCard className="bg-white border-zinc-200" padding="p-4">
          <p className="text-zinc-500 text-xs mb-1">{t('envPage.configured')}</p>
          <p className="text-2xl font-bold text-emerald-500">{configuredCount}</p>
        </ProCard>
        <ProCard className="bg-white border-zinc-200" padding="p-4">
          <p className="text-zinc-500 text-xs mb-1">{t('envPage.missing')}</p>
          <p className="text-2xl font-bold text-red-500">{totalCount - configuredCount}</p>
        </ProCard>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none z-10" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('envPage.search')}
          size="md"
          className="pl-10"
        />
      </div>

      {/* Groups */}
      <div className="space-y-6">
        {filteredGroups.map((group) => (
          <div key={group.name}>
            <h3 className="text-sm font-medium text-zinc-500 mb-3">{group.name}</h3>
            <div className="space-y-2">
              {group.vars.map((v) => (
                <EnvVarCard
                  key={v.key}
                  variable={v}
                  expanded={expandedVar === v.key}
                  onToggle={() => setExpandedVar(expandedVar === v.key ? null : v.key)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EnvVarCard({
  variable: v,
  expanded,
  onToggle,
}: {
  variable: EnvVarDetail;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();

  return (
    <ProCard
      className={`bg-white border transition-all ${
        v.configured ? 'border-emerald-200' : 'border-red-200'
      }`}
      padding="p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <code className="text-sm font-mono text-zinc-900 font-medium">{v.key}</code>
            {v.required && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">
                {t('envPage.required')}
              </span>
            )}
            {!v.required && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-medium">
                {t('envPage.optional')}
              </span>
            )}
          </div>
          <p className="text-zinc-500 text-xs mb-1.5">{v.description}</p>
          <p className="text-blue-600 text-xs leading-relaxed">{v.usage}</p>
        </div>
        <div className="shrink-0 mt-1">
          {v.configured ? (
            <div className="flex items-center gap-1.5 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs">{t('envPage.configuredLabel')}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-red-500">
              <XCircle className="h-4 w-4" />
              <span className="text-xs">{t('envPage.missingLabel')}</span>
            </div>
          )}
        </div>
      </div>

      {/* 获取教程按钮 */}
      <button
        onClick={onToggle}
        className="mt-3 flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 transition-colors"
      >
        <BookOpen className="h-3.5 w-3.5" />
        <span>{t('envPage.howToGet')}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* 展开的教程内容 */}
      {expanded && (
        <div className="mt-3 p-3 rounded-lg bg-zinc-50 border border-zinc-200">
          <pre className="text-xs text-zinc-600 whitespace-pre-wrap font-mono leading-relaxed">
            {v.hint}
          </pre>
        </div>
      )}
    </ProCard>
  );
}
