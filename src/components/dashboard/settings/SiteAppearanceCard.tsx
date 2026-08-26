'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Paintbrush } from 'lucide-react';
import { ProCard } from '@/components/ui/ProCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SuccessAlert } from '@/components/ui/SuccessAlert';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { apiJson, isUnauthorized, redirectToHome } from '@/lib/api-client';

/** site-config 两个配置项的展示名，部分失败时用于提示是哪一项写入失败 */
const HERO_CONFIG_ITEMS = ['gradient', 'image_url'] as const;

const GRADIENT_PRESETS = [
  { labelKey: 'settings.gradientBluePurple', value: 'from-blue-50 via-transparent to-purple-50' },
  { labelKey: 'settings.gradientMint', value: 'from-emerald-50 via-teal-50 to-cyan-50' },
  { labelKey: 'settings.gradientSunset', value: 'from-amber-50 via-orange-50 to-yellow-50' },
  { labelKey: 'settings.gradientRose', value: 'from-pink-50 via-rose-50 to-red-50' },
  { labelKey: 'settings.gradientIndigo', value: 'from-indigo-50 via-blue-50 to-sky-50' },
  { labelKey: 'settings.gradientWhite', value: 'from-white via-zinc-50 to-zinc-100' },
];

/** 首页 Hero 背景外观配置 */
export function SiteAppearanceCard() {
  const { t } = useTranslation();
  const [heroGradient, setHeroGradient] = useState('from-blue-50 via-transparent to-purple-50');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [heroSaving, setHeroSaving] = useState(false);
  const [heroMsg, setHeroMsg] = useState<string | null>(null);
  const [heroMsgType, setHeroMsgType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    // 初始化读取已保存配置（保持原实现：失败时保留默认值）
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiJson<{ hero_gradient?: string; hero_image_url?: string }>(
          '/api/site-config'
        );
        if (!cancelled) {
          if (data.hero_gradient) setHeroGradient(data.hero_gradient);
          if (data.hero_image_url !== undefined) setHeroImageUrl(data.hero_image_url);
        }
      } catch (err) {
        if (isUnauthorized(err)) redirectToHome();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveHeroConfig = async () => {
    setHeroSaving(true);
    setHeroMsg(null);
    try {
      // 使用 Promise.allSettled 并行保存，确保两个配置都尝试写入
      const results = await Promise.allSettled([
        apiJson('/api/site-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'hero_gradient', value: heroGradient }),
        }),
        apiJson('/api/site-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'hero_image_url', value: heroImageUrl }),
        }),
      ]);
      let unauthorized = false;
      const failedItems: string[] = [];
      results.forEach((r, idx) => {
        if (r.status !== 'rejected') return;
        if (isUnauthorized(r.reason)) unauthorized = true;
        failedItems.push(HERO_CONFIG_ITEMS[idx]);
      });
      if (unauthorized) {
        redirectToHome();
        return;
      }
      if (failedItems.length > 0) {
        // 部分失败时带上具体是哪一项失败，便于排查
        setHeroMsgType('error');
        setHeroMsg(`${t('settings.configSaveFailed')}: ${failedItems.join(', ')}`);
      } else {
        setHeroMsgType('success');
        setHeroMsg(t('settings.configSaved'));
      }
    } finally {
      setHeroSaving(false);
    }
  };

  return (
    <ProCard className="bg-white border-zinc-200" padding="p-5">
      <div className="flex items-center gap-3 mb-4">
        <Paintbrush className="h-5 w-5 text-zinc-500" />
        <h3 className="text-zinc-900 font-medium">{t('settings.heroBackground')}</h3>
      </div>
      <div className="mb-4">
        <p className="text-xs font-medium text-zinc-600 mb-2">{t('settings.presetGradients')}</p>
        <div className="grid grid-cols-3 gap-2">
          {GRADIENT_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => {
                setHeroGradient(preset.value);
                setHeroImageUrl('');
              }}
              className={`h-12 rounded-lg bg-gradient-to-br ${preset.value} border-2 transition-all ${heroGradient === preset.value && !heroImageUrl ? 'border-blue-500 shadow-md' : 'border-zinc-200 hover:border-zinc-300'}`}
              title={t(preset.labelKey)}
            >
              <span className="text-[10px] font-medium text-zinc-600 bg-white/80 px-1.5 py-0.5 rounded">
                {t(preset.labelKey)}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <p className="text-xs font-medium text-zinc-600 mb-2">{t('settings.customImageUrl')}</p>
        <Input
          type="url"
          value={heroImageUrl}
          onChange={(e) => {
            setHeroImageUrl(e.target.value);
            setHeroGradient('');
          }}
          placeholder="https://example.com/image.jpg"
          size="sm"
        />
      </div>
      <Button variant="default" onClick={saveHeroConfig} loading={heroSaving}>
        {t('settings.saveConfig')}
      </Button>
      {heroMsg &&
        (heroMsgType === 'success' ? (
          <SuccessAlert message={heroMsg} />
        ) : (
          <ErrorAlert message={heroMsg} className="mt-3" />
        ))}
    </ProCard>
  );
}
