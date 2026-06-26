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
  /** 自定义渐变 className，如 "from-blue-50 to-purple-50" */
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

  const renderContent = () => (
    <>
      {tips && (
        <span className="inline-block text-xs px-3 py-1 bg-zinc-100 rounded-full text-zinc-600 mb-4 font-medium">
          {tips}
        </span>
      )}
      <h1
        className={`${sizeStyle.title} font-bold text-zinc-900 tracking-tight leading-tight mb-4`}
      >
        {title}
      </h1>
      {description && <p className="text-base sm:text-lg text-zinc-500 max-w-2xl">{description}</p>}
      {buttons && buttons.length > 0 && (
        <div
          className={`flex flex-wrap gap-3 mt-6 ${
            align === 'center' ? 'justify-center' : 'justify-start'
          }`}
        >
          {buttons.map((btn, i) => {
            const btnBase =
              btn.variant === 'primary'
                ? 'bg-zinc-900 text-white hover:bg-zinc-800 border-transparent'
                : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50';
            const btnClasses = `inline-flex items-center gap-2 px-5 py-2.5 rounded-xl ${btnBase} transition-all font-medium text-sm shadow-sm`;

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

  const bgClassName = gradient ? `bg-gradient-to-br ${gradient}` : 'bg-zinc-50';

  return (
    <>
      <motion.section
        className={`relative w-full overflow-hidden rounded-2xl sm:rounded-3xl ${sizeStyle.padding} px-6 sm:px-8 ${bgClassName} ${className}`}
        animate={!backgroundImage ? { opacity: 1 } : undefined}
        transition={!backgroundImage ? { duration: 0.6, ease: 'easeOut' } : undefined}
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
