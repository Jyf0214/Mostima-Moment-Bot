import { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import '@/i18n';
import '@/app/globals.css';
import { LoadingSpinner } from '@/components/ui/Button/LoadingSpinner';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkEnv = async () => {
      try {
        const response = await fetch('/api/env-check');
        const data = await response.json();

        if (!data.isConfigured && router.pathname !== '/env-error') {
          router.push('/env-error');
          return;
        }

        if (data.isConfigured) {
          fetch('/api/init', { method: 'POST' }).catch(() => {});
        }
      } catch (err) {
        console.error('Failed to check environment variables:', err);
      } finally {
        setChecking(false);
      }
    };

    if (router.pathname === '/env-error') {
      setChecking(false);
      return;
    }

    checkEnv();
  }, [router]);

  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return <Component {...pageProps} />;
}
