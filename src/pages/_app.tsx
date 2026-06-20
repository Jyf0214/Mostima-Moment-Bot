'use client';

import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { AppProps } from 'next/app';
import '@/i18n';
import { theme } from '@/theme';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MantineProvider theme={theme}>
      <Component {...pageProps} />
    </MantineProvider>
  );
}
