'use client';

import React, { useState } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/ui';

export interface ConfigSectionProps {
  title: string;
  icon?: LucideIcon;
  color?: string;
  children: React.ReactNode;
  className?: string;
  id?: string; // 锚点 ID，用于侧边导航跳转
  defaultOpen?: boolean; // 默认是否展开，默认 true
}

export default function ConfigSection({
  title,
  icon: Icon,
  color = 'bg-zinc-500',
  children,
  className = '',
  id,
  defaultOpen = true,
}: ConfigSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      id={id}
      className={cn(
        'bg-white rounded-2xl border border-zinc-100 scroll-mt-24 transition-all',
        className
      )}
    >
      {/* 标题栏：可点击折叠 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 p-6 pb-0 text-left group"
      >
        {Icon ? (
          <span
            className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', color)}
          >
            <Icon size={16} className="text-white" />
          </span>
        ) : (
          <span className={cn('w-2 h-2 rounded-full shrink-0', color)} />
        )}
        <span className="text-base font-bold text-zinc-900 flex-1">{title}</span>
        <ChevronDown
          size={16}
          className={cn(
            'text-zinc-400 transition-transform duration-200 shrink-0',
            open ? 'rotate-0' : '-rotate-90'
          )}
        />
      </button>

      {/* 内容区域 */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          open ? 'max-h-none opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="p-6 pt-4">{children}</div>
      </div>
    </div>
  );
}
