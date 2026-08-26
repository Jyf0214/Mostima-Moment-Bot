'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/ui';
import {
  LayoutDashboard,
  Plug,
  FolderGit2,
  Shield,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ScrollText,
  Key,
  Server,
} from 'lucide-react';

export type SidebarPage =
  | 'overview'
  | 'repos'
  | 'logs'
  | 'runners'
  | 'env'
  | 'apikeys'
  | 'settings';

interface SidebarProps {
  activePage: SidebarPage;
  onNavigate: (page: SidebarPage) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  userLogin: string;
  onLogout: () => void;
  /** 登出请求进行中：禁用按钮并旋转图标 */
  loggingOut?: boolean;
}

/** 侧边栏按功能域分三组：总览 / CI 运转 / 系统配置（此前七项平铺无层次） */
const NAV_GROUPS: {
  labelKey: string;
  items: { id: SidebarPage; icon: React.ElementType; labelKey: string }[];
}[] = [
  {
    labelKey: 'sidebar.groupOverview',
    items: [{ id: 'overview', icon: LayoutDashboard, labelKey: 'sidebar.overview' }],
  },
  {
    labelKey: 'sidebar.groupCi',
    items: [
      { id: 'repos', icon: FolderGit2, labelKey: 'sidebar.repos' },
      { id: 'logs', icon: ScrollText, labelKey: 'sidebar.logs' },
      { id: 'runners', icon: Server, labelKey: 'sidebar.runners' },
    ],
  },
  {
    labelKey: 'sidebar.groupSystem',
    items: [
      { id: 'env', icon: Shield, labelKey: 'sidebar.envVars' },
      { id: 'apikeys', icon: Key, labelKey: 'sidebar.apiKeys' },
      { id: 'settings', icon: Settings, labelKey: 'sidebar.settings' },
    ],
  },
];

export default function Sidebar({
  activePage,
  onNavigate,
  collapsed,
  onToggleCollapse,
  userLogin,
  onLogout,
  loggingOut,
}: SidebarProps) {
  const { t } = useTranslation();
  const [botName, setBotName] = useState('Bot');

  useEffect(() => {
    const fetchBotName = async () => {
      try {
        const res = await fetch('/api/bot/info');
        if (res.ok) {
          const data = await res.json();
          if (data?.slug) setBotName(data.slug);
        }
      } catch {
        /* 使用默认值 */
      }
    };
    fetchBotName();
  }, []);

  return (
    <div
      className={cn(
        'flex flex-col h-screen bg-white border-r border-zinc-200 transition-all duration-200 shrink-0',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex items-center border-b border-zinc-100 shrink-0',
          collapsed ? 'justify-center h-14 px-0' : 'gap-2 h-14 px-4'
        )}
      >
        <div className="h-7 w-7 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0">
          <Plug className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <span className="text-zinc-900 font-semibold text-sm truncate">{botName}</span>
        )}
      </div>

      {/* Navigation — 原生 <nav>/<button>/<a> 已有隐式 ARIA role，无需显式添加 role 属性 */}
      <nav
        aria-label={t('sidebar.navLabel') || 'Main navigation'}
        className="flex-1 py-3 px-2 space-y-1 overflow-y-auto min-h-0"
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.labelKey} className="mb-2">
            {!collapsed ? (
              <p className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                {t(group.labelKey)}
              </p>
            ) : (
              /* 折叠模式下组标题退化为细分隔线，保留视觉分组 */
              <div className="mx-2 my-2 border-t border-zinc-100" />
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  aria-label={t(item.labelKey)}
                  title={collapsed ? t(item.labelKey) : undefined}
                  className={cn(
                    'w-full flex items-center rounded-xl text-sm transition-all',
                    collapsed ? 'justify-center h-10' : 'gap-3 px-3 py-2.5',
                    isActive
                      ? 'bg-gradient-to-r from-zinc-900 to-zinc-800 text-white shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-zinc-100 shrink-0">
        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          className={cn(
            'w-full flex items-center text-sm text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition-all',
            collapsed ? 'justify-center h-10' : 'gap-3 px-3 py-2.5'
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('sidebar.collapse')}</span>
            </>
          )}
        </button>

        {/* User */}
        <div
          className={cn(
            'border-t border-zinc-100 flex items-center shrink-0',
            collapsed ? 'justify-center h-12' : 'justify-between px-3 py-2'
          )}
        >
          {!collapsed && <span className="text-zinc-500 text-xs truncate">@{userLogin}</span>}
          <button
            onClick={onLogout}
            disabled={loggingOut}
            className="text-zinc-400 hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('home.logout')}
            aria-label={t('home.logout')}
          >
            <LogOut className={`h-3.5 w-3.5 ${loggingOut ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
