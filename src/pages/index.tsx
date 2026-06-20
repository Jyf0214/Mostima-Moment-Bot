'use client';

import { useState, useEffect } from 'react';
import { LogOut, Settings, Terminal, FileText, Lock, Rocket, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { ProCard } from '@/components/ui/ProCard';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';

/* ------------------------------------------------------------------ */
/*  Inline SVG — lucide-react has no GitHub brand icon                 */
/* ------------------------------------------------------------------ */

function GithubIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
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

/* ------------------------------------------------------------------ */
/*  Feature card icon color map                                        */
/* ------------------------------------------------------------------ */

const featureColorMap = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-600' },
} as const;

/* ------------------------------------------------------------------ */
/*  Feature card data                                                  */
/* ------------------------------------------------------------------ */

interface FeatureItem {
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
  color: 'blue' | 'violet' | 'teal';
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function Home() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [isNew, setIsNew] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const statusRes = await fetch('/api/auth/status');
      const statusData = await statusRes.json();
      setIsNew(statusData.isNew);

      if (statusData.isNew) {
        window.location.href = '/setup';
        return;
      }

      const userRes = await fetch('/api/auth/me');
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
      }
    } catch (err) {
      console.error('Failed to check status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  /* -------------------------------------------------------------- */
  /*  Feature cards config                                          */
  /* -------------------------------------------------------------- */

  const features: FeatureItem[] = [
    {
      icon: <Terminal size={24} />,
      titleKey: 'home.featureCicdTitle',
      descKey: 'home.featureCicdDesc',
      color: 'blue',
    },
    {
      icon: <FileText size={24} />,
      titleKey: 'home.featurePrTitle',
      descKey: 'home.featurePrDesc',
      color: 'violet',
    },
    {
      icon: <Lock size={24} />,
      titleKey: 'home.featureWebhookTitle',
      descKey: 'home.featureWebhookDesc',
      color: 'teal',
    },
  ];

  /* -------------------------------------------------------------- */
  /*  Hero buttons config                                           */
  /* -------------------------------------------------------------- */

  const heroButtons = user
    ? [
        {
          label: t('home.dashboard'),
          href: '/dashboard',
          variant: 'primary' as const,
          icon: <Settings size={18} />,
        },
      ]
    : [
        {
          label: t('home.loginGithub'),
          href: '/api/auth/login',
          variant: 'primary' as const,
          icon: <GithubIcon size={20} />,
        },
      ];

  /* -------------------------------------------------------------- */
  /*  Loading state                                                  */
  /* -------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  /* -------------------------------------------------------------- */
  /*  Main render                                                    */
  /* -------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ============================================================ */}
      {/* Hero Section                                                  */}
      {/* ============================================================ */}
      <HeroBanner
        title={t('app.title')}
        description={t('home.heroDescription')}
        tips={t('home.heroTagline')}
        gradient="linear-gradient(135deg, #0f172a 0%, #1e293b 30%, #1e3a5f 60%, #2563eb 100%)"
        align="center"
        size="large"
        buttons={[
          ...heroButtons,
          ...(user
            ? []
            : [
                {
                  label: t('home.learnMore'),
                  variant: 'ghost' as const,
                  icon: <ArrowRight size={16} />,
                  onClick: () => {
                    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                  },
                },
              ]),
        ]}
      />

      {/* ============================================================ */}
      {/* Features Section                                              */}
      {/* ============================================================ */}
      <section id="features">
        <PageContainer maxWidth="7xl" padding="wide">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              {t('home.featuresTitle')}
            </h2>
            <p className="mt-3 text-lg text-zinc-500">{t('home.featuresSubtitle')}</p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feat) => {
              const colors = featureColorMap[feat.color];
              return (
                <ProCard key={feat.titleKey} hoverable bordered padding="p-8">
                  <div
                    className={`mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl ${colors.bg} ${colors.text}`}
                  >
                    {feat.icon}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-zinc-900">{t(feat.titleKey)}</h3>
                  <p className="text-sm leading-relaxed text-zinc-500">{t(feat.descKey)}</p>
                </ProCard>
              );
            })}
          </div>
        </PageContainer>
      </section>

      {/* ============================================================ */}
      {/* User Profile Section (logged in only)                        */}
      {/* ============================================================ */}
      {user && (
        <section>
          <PageContainer maxWidth="3xl" padding="default">
            <ProCard bordered padding="p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Left — avatar + info */}
                <div className="flex items-center gap-4">
                  <img
                    src={user.avatarUrl}
                    alt={user.githubLogin}
                    className="h-14 w-14 rounded-full object-cover"
                  />
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg font-semibold text-zinc-900">
                        {user.githubLogin}
                      </span>
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                          user.isAdmin ? 'bg-blue-50 text-blue-700' : 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {user.isAdmin ? t('home.roleAdmin') : t('home.roleUser')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-zinc-500">{t('home.welcomeBack')}</p>
                  </div>
                </div>

                {/* Right — action buttons */}
                <div className="flex items-center gap-2.5">
                  <Button
                    variant="primary"
                    size="md"
                    icon={<Settings size={16} />}
                    onClick={() => {
                      window.location.href = '/dashboard';
                    }}
                  >
                    {t('home.dashboard')}
                  </Button>
                  <Button
                    variant="danger"
                    size="md"
                    icon={<LogOut size={16} />}
                    onClick={handleLogout}
                  >
                    {t('home.logout')}
                  </Button>
                </div>
              </div>
            </ProCard>
          </PageContainer>
        </section>
      )}

      {/* ============================================================ */}
      {/* Footer                                                        */}
      {/* ============================================================ */}
      <footer className="border-t border-zinc-200 bg-white py-10">
        <PageContainer maxWidth="7xl" padding="compact">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-sm text-zinc-500">{t('app.title')}</span>
            <span className="text-sm text-zinc-500">{t('app.description')}</span>
          </div>
        </PageContainer>
      </footer>
    </div>
  );
}
