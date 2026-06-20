'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/ui';
import {
  LayoutDashboard,
  Plug,
  Shield,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export type SidebarPage = 'overview' | 'repos' | 'env' | 'settings';

interface SidebarProps {
  activePage: SidebarPage;
  onNavigate: (page: SidebarPage) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  userLogin: string;
  onLogout: () => void;
}

const NAV_ITEMS: { id: SidebarPage; icon: React.ElementType; labelKey: string }[] = [
  { id: 'overview', icon: LayoutDashboard, labelKey: 'sidebar.overview' },
  { id: 'repos', icon: Plug, labelKey: 'sidebar.repos' },
  { id: 'env', icon: Shield, labelKey: 'sidebar.envVars' },
  { id: 'settings', icon: Settings, labelKey: 'sidebar.settings' },
];

export default function Sidebar({
  activePage,
  onNavigate,
  collapsed,
  onToggleCollapse,
  userLogin,
  onLogout,
}: SidebarProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-white/5 backdrop-blur-xl border-r border-white/10 transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-white/10 shrink-0">
        <div className="h-7 w-7 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
          <Plug className="h-4 w-4 text-purple-400" />
        </div>
        {!collapsed && (
          <span className="text-white font-semibold text-sm truncate">Manticore Bot</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-white/10 p-2 space-y-1 shrink-0">
        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
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
        {!collapsed && (
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-white/50 text-xs truncate">@{userLogin}</span>
            <button
              onClick={onLogout}
              className="text-white/40 hover:text-red-400 transition-colors"
              title={t('home.logout')}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
