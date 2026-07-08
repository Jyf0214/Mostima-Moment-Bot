'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProCard } from '@/components/ui/ProCard';
import { StatusCard } from '@/components/ui/StatusCard';
import { RefreshCw, Plus, Trash2, Key, Clock, CheckCircle2, Copy, X } from 'lucide-react';

interface ApiKeyItem {
  id: number;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
  isActive: boolean;
}

interface CreatedKey {
  id: number;
  name: string;
  key: string;
  createdAt: string;
}

export default function ApiKeyPage() {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/api-keys');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setKeys(data.keys || []);
    } catch {
      setError(t('apiKey.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setCreatedKey(data);
      setNewKeyName('');
      await fetchKeys();
    } catch {
      setError(t('apiKey.failedToCreate'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    // API 密钥一旦删除无法恢复，需要二次确认
    if (!window.confirm(t('apiKey.deleteConfirm', { name }))) {
      return;
    }
    try {
      const res = await fetch(`/api/auth/api-keys?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      await fetchKeys();
    } catch {
      setError(t('apiKey.failedToDelete'));
    }
  };

  const handleCopyKey = () => {
    if (createdKey?.key) {
      navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const timeAgo = (dateStr: string) => {
    // eslint-disable-next-line react-hooks/purity -- Date.now() is acceptable for display-only time formatting
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return t('common.secondsAgo', { count: String(diff) });
    if (diff < 3600) return t('common.minutesAgo', { count: String(Math.floor(diff / 60)) });
    if (diff < 86400) return t('common.hoursAgo', { count: String(Math.floor(diff / 3600)) });
    return t('common.daysAgo', { count: String(Math.floor(diff / 86400)) });
  };

  return (
    <div className="space-y-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
            <Key className="h-5 w-5 text-zinc-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">{t('apiKey.title')}</h2>
            <p className="text-zinc-500 text-xs">{t('apiKey.subtitle')}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />}
          onClick={fetchKeys}
          className="text-zinc-500 hover:text-zinc-700"
        >
          {t('dashboard.refresh')}
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <ProCard className="bg-red-50 border-red-200">
          <StatusCard
            icon={<X className="h-4 w-4" />}
            title={t('dashboard.error')}
            status={error}
            statusType="error"
          />
        </ProCard>
      )}

      {/* 新建密钥成功提示 - 显示完整密钥内容 */}
      {createdKey && (
        <ProCard className="bg-red-50 border-red-300 border-2">
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-red-600 text-lg font-bold">!</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-red-800">{t('apiKey.createdSuccess')}</p>
              <p className="text-xs text-red-700 mt-1 font-medium">⚠️ {t('apiKey.createdHint')}</p>
              <div className="mt-3">
                <p className="text-xs text-zinc-600 mb-1">API Key:</p>
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 px-3 py-2.5 rounded-lg bg-white border border-red-200 text-zinc-900 text-sm font-mono break-all select-all"
                    style={{ userSelect: 'all' }}
                  >
                    {createdKey.key}
                  </code>
                  <Button
                    variant="default"
                    size="sm"
                    icon={
                      copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />
                    }
                    onClick={handleCopyKey}
                    className="shrink-0"
                  >
                    {copied ? t('apiKey.copied') : t('apiKey.copy')}
                  </Button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setCreatedKey(null)}
              className="text-zinc-400 hover:text-zinc-600 shrink-0"
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </ProCard>
      )}

      {/* 创建新密钥 */}
      <ProCard title={t('apiKey.createTitle')}>
        <div className="flex items-center gap-3">
          <Input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder={t('apiKey.namePlaceholder')}
            size="sm"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Button
            variant="default"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={handleCreate}
            loading={creating}
            disabled={!newKeyName.trim()}
          >
            {t('apiKey.createButton')}
          </Button>
        </div>
      </ProCard>

      {/* 密钥列表 */}
      <ProCard title={`${t('apiKey.existingKeys')} (${keys.length})`}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-500" />
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8">
            <Key className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">{t('apiKey.noKeys')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4"
              >
                <Key className="h-4 w-4 text-zinc-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-900 truncate">{key.name}</p>
                    <span className="text-xs text-zinc-400 font-mono">
                      ****{key.id.toString().slice(-4)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-zinc-400">
                      {t('apiKey.createdAt')} {timeAgo(key.createdAt)}
                    </span>
                    {key.lastUsedAt && (
                      <span className="text-xs text-zinc-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {t('apiKey.lastUsed')} {timeAgo(key.lastUsedAt)}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => handleDelete(key.id, key.name)}
                  className="text-zinc-400 hover:text-red-500"
                >
                  {t('apiKey.delete')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </ProCard>

      {/* 使用说明 */}
      <ProCard title={t('apiKey.usageTitle')}>
        <div className="space-y-4">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
            <p className="text-xs font-bold text-emerald-800 mb-2">
              {t('apiKey.usageRecommended')}
            </p>
            <code className="block px-3 py-2 rounded-lg bg-white border border-emerald-200 text-zinc-700 text-xs font-mono break-all">
              {`curl -H "Authorization: Bearer YOUR_API_KEY" https://your-domain.com/api/ci/runs`}
            </code>
            <p className="text-xs text-emerald-700 mt-2">{t('apiKey.usageRecommendedDesc')}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-zinc-600 mb-2">{t('apiKey.usageOther')}</p>
            <div className="space-y-2">
              <div className="rounded-lg bg-zinc-50 p-3">
                <p className="text-xs text-zinc-600 mb-1">{t('apiKey.usageGetJwt')}</p>
                <code className="block px-2 py-1.5 rounded bg-white border border-zinc-200 text-zinc-700 text-xs font-mono">
                  {`POST /api/auth/api-key-login\n{"apiKey": "YOUR_API_KEY"}`}
                </code>
              </div>
              <div className="rounded-lg bg-zinc-50 p-3">
                <p className="text-xs text-zinc-600 mb-1">{t('apiKey.usageUseJwt')}</p>
                <code className="block px-2 py-1.5 rounded bg-white border border-zinc-200 text-zinc-700 text-xs font-mono">
                  {`curl -H "Authorization: Bearer JWT_TOKEN" https://your-domain.com/api/ci/runs`}
                </code>
              </div>
            </div>
          </div>
        </div>
      </ProCard>
    </div>
  );
}
