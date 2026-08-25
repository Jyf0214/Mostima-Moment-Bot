import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

/**
 * 路由切换顶部进度条
 *
 * - 只在导航耗时超过 DELAY_MS 时才出现，避免 shallow/tab 秒切时的闪烁
 * - 监听 Next.js Pages Router 路由事件，无需第三方依赖
 */

const DELAY_MS = 150;

export default function TopProgressBar() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearShowTimer = () => {
      if (showTimer.current) {
        clearTimeout(showTimer.current);
        showTimer.current = null;
      }
    };

    const onStart = () => {
      clearShowTimer();
      showTimer.current = setTimeout(() => setVisible(true), DELAY_MS);
    };
    const onDone = () => {
      clearShowTimer();
      setVisible(false);
    };

    router.events.on('routeChangeStart', onStart);
    router.events.on('routeChangeComplete', onDone);
    router.events.on('routeChangeError', onDone);
    return () => {
      clearShowTimer();
      router.events.off('routeChangeStart', onStart);
      router.events.off('routeChangeComplete', onDone);
      router.events.off('routeChangeError', onDone);
    };
  }, [router]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden" aria-hidden="true">
      <div className="h-full w-1/3 animate-progress-slide bg-blue-500" />
    </div>
  );
}
