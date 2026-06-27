'use client';

import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { ProCard } from '@/components/ui/ProCard';
import {
  GitBranch,
  Shield,
  FileCheck,
  MessageSquare,
  Zap,
  Lock,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Code,
  Box,
  Cog,
  Globe,
  Key,
  Terminal,
} from 'lucide-react';

function GithubIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

interface User {
  githubId: number;
  githubLogin: string;
  avatarUrl: string;
  isAdmin: boolean;
}

export default function HomePage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [heroGradient, setHeroGradient] = useState('from-blue-50 via-transparent to-purple-50');
  const [heroImageUrl, setHeroImageUrl] = useState('');

  useEffect(() => {
    checkStatus();
    fetchHeroConfig();
  }, []);

  const fetchHeroConfig = async () => {
    try {
      const res = await fetch('/api/site-config');
      if (res.ok) {
        const data = await res.json();
        if (data.hero_gradient) setHeroGradient(data.hero_gradient);
        if (data.hero_image_url) setHeroImageUrl(data.hero_image_url);
      }
    } catch {
      // 使用默认值
    }
  };

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        if (data.githubId) {
          setUser(data);
          window.location.href = '/dashboard';
          return;
        }
      }
    } catch (err) {
      logger.error('Failed to check status:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-500" />
      </div>
    );
  }

  const features = [
    {
      icon: <Zap className="h-6 w-6 text-emerald-500" />,
      title: t('home.featureCicdTitle'),
      desc: t('home.featureCicdDesc'),
      bg: 'bg-emerald-50',
    },
    {
      icon: <FileCheck className="h-6 w-6 text-blue-500" />,
      title: t('home.featurePrTitle'),
      desc: t('home.featurePrDesc'),
      bg: 'bg-blue-50',
    },
    {
      icon: <Shield className="h-6 w-6 text-zinc-600" />,
      title: t('home.featureWebhookTitle'),
      desc: t('home.featureWebhookDesc'),
      bg: 'bg-zinc-100',
    },
  ];

  const steps = [
    { icon: <Code className="h-5 w-5" />, title: t('home.step1Title'), desc: t('home.step1Desc') },
    {
      icon: <GitBranch className="h-5 w-5" />,
      title: t('home.step2Title'),
      desc: t('home.step2Desc'),
    },
    {
      icon: <CheckCircle2 className="h-5 w-5" />,
      title: t('home.step3Title'),
      desc: t('home.step3Desc'),
    },
    {
      icon: <MessageSquare className="h-5 w-5" />,
      title: t('home.step4Title'),
      desc: t('home.step4Desc'),
    },
  ];

  const techItems = [
    { icon: <Terminal className="h-4 w-4" />, name: 'Next.js 16', desc: t('home.techNextjs') },
    { icon: <Box className="h-4 w-4" />, name: 'PostgreSQL', desc: t('home.techPostgres') },
    { icon: <Cog className="h-4 w-4" />, name: 'Docker', desc: t('home.techDocker') },
    { icon: <Shield className="h-4 w-4" />, name: 'HMAC-SHA256', desc: t('home.techHmac') },
    { icon: <Key className="h-4 w-4" />, name: 'JWT', desc: t('home.techJwt') },
    { icon: <Globe className="h-4 w-4" />, name: 'TypeScript', desc: t('home.techTypescript') },
  ];

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Hero */}
      <PageContainer maxWidth="6xl" padding="wide">
        <div className="pt-8">
          <HeroBanner
            title={t('home.welcome')}
            description={t('home.heroDescription')}
            tips={t('home.heroTagline')}
            buttons={[
              {
                label: t('home.loginGithub'),
                onClick: () => (window.location.href = '/api/auth/login'),
                icon: <GithubIcon size={20} />,
                variant: 'primary',
              },
              {
                label: t('home.learnMore'),
                onClick: () =>
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }),
                variant: 'ghost',
              },
            ]}
            gradient={heroImageUrl ? undefined : heroGradient}
            backgroundImage={heroImageUrl || undefined}
            align="center"
          />
        </div>
      </PageContainer>

      {/* Features */}
      <section id="features">
        <PageContainer maxWidth="6xl" padding="default">
          <div className="py-16 sm:py-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 mb-3">
                {t('home.featuresTitle')}
              </h2>
              <p className="text-zinc-500 text-lg">{t('home.featuresSubtitle')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {features.map((f, i) => (
                <ProCard
                  key={i}
                  className="bg-white border-zinc-200 hover:shadow-md transition-all"
                  padding="p-6"
                >
                  <div
                    className={`h-12 w-12 rounded-xl ${f.bg} flex items-center justify-center mb-4`}
                  >
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 mb-2">{f.title}</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
                </ProCard>
              ))}
            </div>
          </div>
        </PageContainer>
      </section>

      {/* How it works */}
      <section>
        <PageContainer maxWidth="6xl" padding="default">
          <div className="py-16 sm:py-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 mb-3">
                {t('home.howItWorks')}
              </h2>
              <p className="text-zinc-500 text-lg">{t('home.howItWorksSubtitle')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((s, i) => (
                <div key={i} className="relative">
                  <ProCard className="bg-white border-zinc-200 h-full" padding="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white text-sm font-bold">
                        {i + 1}
                      </div>
                      <div className="text-zinc-600">{s.icon}</div>
                    </div>
                    <h3 className="text-base font-semibold text-zinc-900 mb-1">{s.title}</h3>
                    <p className="text-zinc-500 text-sm leading-relaxed">{s.desc}</p>
                  </ProCard>
                  {i < steps.length - 1 && (
                    <div className="hidden lg:flex absolute top-1/2 -right-3 transform -translate-y-1/2 text-zinc-300">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </PageContainer>
      </section>

      {/* Tech Stack */}
      <section>
        <PageContainer maxWidth="6xl" padding="default">
          <div className="py-16 sm:py-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 mb-3">
                {t('home.techStack')}
              </h2>
              <p className="text-zinc-500 text-lg">{t('home.techStackSubtitle')}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {techItems.map((tech, i) => (
                <div
                  key={i}
                  className="bg-white border border-zinc-200 rounded-xl p-4 text-center hover:shadow-md transition-all"
                >
                  <div className="text-zinc-600 flex justify-center mb-2">{tech.icon}</div>
                  <p className="text-zinc-900 font-semibold text-sm mb-1">{tech.name}</p>
                  <p className="text-zinc-500 text-xs">{tech.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </PageContainer>
      </section>

      {/* CTA */}
      <section>
        <PageContainer maxWidth="4xl" padding="default">
          <div className="py-16 sm:py-20">
            <ProCard className="bg-white border-zinc-200 text-center" padding="p-10 sm:p-14">
              <Lock className="h-10 w-10 text-zinc-500 mx-auto mb-4" />
              <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 mb-3">
                {t('home.ctaTitle')}
              </h2>
              <p className="text-zinc-500 text-lg mb-8 max-w-lg mx-auto">{t('home.ctaSubtitle')}</p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button
                  variant="primary"
                  size="lg"
                  icon={<GithubIcon size={20} />}
                  onClick={() => (window.location.href = '/api/auth/login')}
                >
                  {t('home.loginGithub')}
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  icon={<BarChart3 className="h-4 w-4" />}
                  onClick={() =>
                    window.open('https://github.com/Jyf0214/Mostima-Moment-Bot', '_blank')
                  }
                >
                  {t('home.viewOnGithub')}
                </Button>
              </div>
            </ProCard>
          </div>
        </PageContainer>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200">
        <PageContainer maxWidth="6xl" padding="compact">
          <div className="py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-zinc-500" />
              <span className="text-zinc-700 text-sm font-medium">Manticore Bot</span>
            </div>
            <p className="text-zinc-400 text-xs text-center">{t('home.footerDesc')}</p>
            <p className="text-zinc-400 text-xs">{t('home.footerLicense')}</p>
          </div>
        </PageContainer>
      </footer>
    </div>
  );
}
