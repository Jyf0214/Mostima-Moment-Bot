import { type ReactNode, memo } from 'react';
import { cn } from '@/lib/ui';

export interface ButtonGroupProps {
  /** 主按钮内容 */
  primary?: ReactNode;
  /** 次按钮内容 */
  secondary?: ReactNode;
  /** 是否处于加载状态 */
  loading?: boolean;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 按钮组 — 右对齐的按钮布局，支持主/次按钮和加载状态
 */
export const ButtonGroup = memo<ButtonGroupProps>(({ primary, secondary, loading, className }) => {
  return (
    <div className={cn('flex justify-end items-center gap-3', className)}>
      {/* 次按钮 */}
      {secondary && (
        <span className={loading ? 'pointer-events-none opacity-50' : ''}>{secondary}</span>
      )}
      {/* 主按钮 */}
      {primary && (
        <span className={loading ? 'pointer-events-none opacity-50' : ''}>{primary}</span>
      )}
    </div>
  );
});

ButtonGroup.displayName = 'ButtonGroup';
export default ButtonGroup;
