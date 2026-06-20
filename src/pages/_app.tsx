'use client';

import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { AppProps } from 'next/app';
import { useEffect } from 'react';
import '@/i18n';
import { theme } from '@/theme';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // 应用启动时初始化数据库
    fetch('/api/init', { method: 'POST' }).catch(() => {
      // 静默处理初始化错误
    });
  }, []);

  return (
    <MantineProvider theme={theme}>
      <Component {...pageProps} />
    </MantineProvider>
  );
}
