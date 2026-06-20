'use client';

import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Center, Loader } from '@mantine/core';
import '@/i18n';
import { theme } from '@/theme';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // 检查环境变量状态
    const checkEnv = async () => {
      try {
        const response = await fetch('/api/env-check');
        const data = await response.json();

        if (!data.isConfigured && router.pathname !== '/env-error') {
          // 环境变量缺失，重定向到错误页面
          router.push('/env-error');
          return;
        }

        // 环境变量已配置，初始化数据库
        if (data.isConfigured) {
          fetch('/api/init', { method: 'POST' }).catch(() => {
            // 静默处理初始化错误
          });
        }
      } catch (err) {
        console.error('检查环境变量失败:', err);
      } finally {
        setChecking(false);
      }
    };

    // 跳过环境错误页面的检查
    if (router.pathname === '/env-error') {
      setChecking(false);
      return;
    }

    checkEnv();
  }, [router]);

  if (checking) {
    return (
      <MantineProvider theme={theme}>
        <Center h="100vh">
          <Loader size="xl" />
        </Center>
      </MantineProvider>
    );
  }

  return (
    <MantineProvider theme={theme}>
      <Component {...pageProps} />
    </MantineProvider>
  );
}
