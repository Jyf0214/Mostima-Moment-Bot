'use client';

import { useState, useEffect } from 'react';
import { LogOut, Settings, Terminal, FileText, Lock, Rocket, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/* ------------------------------------------------------------------ */
/*  Inline SVG — lucide-react v1 dropped brand icons                   */
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
/*  Color helpers — map FeatureCard color prop to Tailwind classes     */
/* ------------------------------------------------------------------ */

const featureColorMap = {
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
  },
  violet: {
    bg: 'bg-violet-50',
    text: 'text-violet-600',
  },
  teal: {
    bg: 'bg-teal-50',
    text: 'text-teal-600',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  FeatureCard — self-contained card for the features grid            */
/* ------------------------------------------------------------------ */

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'blue' | 'violet' | 'teal';
}

function FeatureCard({ icon, title, description, color }: FeatureCardProps) {
  const colors = featureColorMap[color];

  return (
    <div className="group rounded-xl border border-slate-200 bg-white p-8 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
      <div
        className={`mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl ${colors.bg} ${colors.text}`}
      >
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-500">{description}</p>
    </div>
  );
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
    <div>
      {/* ============================================================ */}
      {/* Hero Section                                                  */}
      {/* ============================================================ */}
      <section className="relative flex min-h-screen items-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 via-40% to-blue-700">
        {/* Decorative background orbs */}
        <div className="pointer-events-none absolute -right-[10%] -top-[20%] h-[600px] w-[600px] rounded-full bg-radial-[circle] from-blue-500/15 to-transparent" />
        <div className="pointer-events-none absolute -bottom-[15%] -left-[5%] h-[400px] w-[400px] rounded-full bg-radial-[circle] from-indigo-500/10 to-transparent" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-80 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-10">
            {/* Tagline badge */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-blue-300">
              <Rocket size={14} />
              {t('home.heroTagline')}
            </span>

            {/* Main title */}
            <h1
              className="text-center font-extrabold leading-tight tracking-tight"
              style={{
                fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                background: 'linear-gradient(135deg, #ffffff 0%, #93c5fd 50%, #60a5fa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {t('app.title')}
            </h1>

            {/* Subtitle */}
            <p
              className="mx-auto max-w-[600px] text-center text-xl leading-7 text-slate-400"
              style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)' }}
            >
              {t('home.heroDescription')}
            </p>

            {/* CTA Buttons */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
              {user ? (
                <>
                  <a
                    href="/dashboard"
                    className="inline-flex items-center gap-2.5 rounded-md border-none bg-gradient-to-br from-blue-600 to-blue-500 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/40 transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/50"
                  >
                    <Settings size={20} />
                    {t('home.dashboard')}
                    <ArrowRight size={18} />
                  </a>
                  <button
                    onClick={handleLogout}
                    title={t('home.logout')}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-slate-400/20 text-slate-400 transition-colors hover:border-slate-400/40 hover:text-slate-300"
                  >
                    <LogOut size={20} />
                  </button>
                </>
              ) : (
                <a
                  href="/api/auth/login"
                  className="inline-flex items-center gap-2.5 rounded-md border-none bg-gradient-to-br from-blue-600 to-blue-500 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/40 transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/50"
                >
                  <GithubIcon size={22} />
                  {t('home.loginGithub')}
                  <ArrowRight size={18} />
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* Features Section                                              */}
      {/* ============================================================ */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 flex flex-col items-center gap-3">
            <h2
              className="text-center font-bold tracking-tight text-slate-900"
              style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}
            >
              {t('home.featuresTitle')}
            </h2>
            <p className="text-center text-lg text-slate-500 max-w-[500px]">
              {t('home.featuresSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3">
            <FeatureCard
              icon={<Terminal size={24} />}
              title={t('home.featureCicdTitle')}
              description={t('home.featureCicdDesc')}
              color="blue"
            />
            <FeatureCard
              icon={<FileText size={24} />}
              title={t('home.featurePrTitle')}
              description={t('home.featurePrDesc')}
              color="violet"
            />
            <FeatureCard
              icon={<Lock size={24} />}
              title={t('home.featureWebhookTitle')}
              description={t('home.featureWebhookDesc')}
              color="teal"
            />
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* User Profile Section (logged in only)                        */}
      {/* ============================================================ */}
      {user && (
        <section className="bg-white py-16">
          <div className="mx-auto max-w-2xl px-4">
            <div className="rounded-xl border border-slate-200 p-8 shadow-sm">
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
                      <span className="text-lg font-semibold text-slate-900">
                        {user.githubLogin}
                      </span>
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                          user.isAdmin ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {user.isAdmin ? t('home.roleAdmin') : t('home.roleUser')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">{t('home.welcomeBack')}</p>
                  </div>
                </div>

                {/* Right — action buttons */}
                <div className="flex items-center gap-2.5">
                  <a
                    href="/dashboard"
                    className="inline-flex items-center gap-2 rounded-md bg-gradient-to-br from-blue-600 to-blue-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-blue-500/30 transition-shadow hover:shadow-md"
                  >
                    <Settings size={18} />
                    {t('home.dashboard')}
                  </a>
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-md bg-red-50 px-5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
                  >
                    <LogOut size={18} />
                    {t('home.logout')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/* Footer                                                        */}
      {/* ============================================================ */}
      <footer className="bg-slate-900 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <hr className="mb-6 border-slate-800" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-sm text-slate-600">{t('app.title')}</span>
            <span className="text-sm text-slate-600">{t('app.description')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
