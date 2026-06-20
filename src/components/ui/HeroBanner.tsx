'use client';

import React from 'react';
import { motion } from 'motion/react';
import Link from 'next/link';

export interface HeroButton {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'ghost';
  icon?: React.ReactNode;
}

export interface HeroBannerProps {
  /** 背景图 URL，未提供时使用渐变色 */
  backgroundImage?: string;
  /** 自定义渐变色，如 "linear-gradient(135deg, #1e3a5f, #581c87)" */
  gradient?: string;
  /** 提示文字标签，如 "最新" "推荐" "更新" */
  tips?: string;
  /** 大标题（必填） */
  title: string;
  /** 描述文字 */
  description?: string;
  /** 按钮组 */
  buttons?: HeroButton[];
  /** 对齐方式，默认居中 */
  align?: 'left' | 'center';
  /** 尺寸，默认 default */
  size?: 'default' | 'compact' | 'large';
  /** 是否启用入场动画，默认 true */
  animate?: boolean;
  /** 额外的 CSS 类名 */
  className?: string;
}

const sizeMap = {
  compact: {
    padding: 'py-8 sm:py-10 md:py-12',
    title: 'text-2xl sm:text-3xl md:text-4xl',
  },
  default: {
    padding: 'py-12 sm:py-16 md:py-20',
    title: 'text-3xl sm:text-4xl md:text-5xl',
  },
  large: {
    padding: 'py-16 sm:py-20 md:py-28',
    title: 'text-4xl sm:text-5xl md:text-6xl',
  },
};

/** 默认渐变背景 —— 3 种颜色缓慢流动 */
const DEFAULT_GRADIENT =
  'linear-gradient(135deg, #18181b 0%, #3f3f46 25%, #292524 50%, #3f3f46 75%, #18181b 100%)';

export function HeroBanner({
  backgroundImage,
  gradient,
  tips,
  title,
  description,
  buttons,
  align = 'center',
  size = 'default',
  animate = true,
  className = '',
}: HeroBannerProps) {
  const sizeStyle = sizeMap[size];
  const hasGradient = !backgroundImage;

  const renderContent = () => (
    <>
      {tips && (
        <span className="inline-block text-xs px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white/90 mb-4">
          {tips}
        </span>
      )}
      <h1 className={`${sizeStyle.title} font-bold text-white tracking-tight leading-tight mb-4`}>
        {title}
      </h1>
      {description && <p className="text-base sm:text-lg text-white/70 max-w-2xl">{description}</p>}
      {buttons && buttons.length > 0 && (
        <div
          className={`flex flex-wrap gap-3 mt-6 ${
            align === 'center' ? 'justify-center' : 'justify-start'
          }`}
        >
          {buttons.map((btn, i) => {
            const btnBase =
              btn.variant === 'primary'
                ? 'bg-white text-zinc-900 hover:bg-white/90 border-transparent'
                : 'bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20';
            const btnClasses = `inline-flex items-center gap-2 px-5 py-2.5 rounded-xl ${btnBase} transition-all font-medium text-sm`;

            const children = (
              <>
                {btn.icon}
                {btn.label}
              </>
            );

            if (btn.href) {
              return (
                <Link key={i} href={btn.href} className={btnClasses}>
                  {children}
                </Link>
              );
            }
            return (
              <button key={i} onClick={btn.onClick} className={btnClasses}>
                {children}
              </button>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <>
      <motion.section
        className={`relative w-full overflow-hidden rounded-2xl sm:rounded-3xl ${sizeStyle.padding} px-6 sm:px-8 ${className}`}
        style={
          hasGradient
            ? {
                background: gradient ?? DEFAULT_GRADIENT,
                backgroundSize: '400% 400%',
              }
            : undefined
        }
        animate={
          hasGradient
            ? {
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }
            : undefined
        }
        transition={hasGradient ? { duration: 18, ease: 'easeInOut', repeat: Infinity } : undefined}
      >
        {/* 背景图 + 遮罩 */}
        {backgroundImage && (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${backgroundImage})` }}
            />
            <div className="absolute inset-0 bg-black/40" />
          </>
        )}

        {/* 内容层 */}
        <div
          className={`relative z-10 flex flex-col ${
            align === 'center' ? 'items-center text-center' : 'items-start text-left'
          }`}
        >
          <div className="w-full max-w-3xl">
            {animate ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              >
                {renderContent()}
              </motion.div>
            ) : (
              renderContent()
            )}
          </div>
        </div>
      </motion.section>
    </>
  );
}
