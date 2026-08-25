import { memo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/ui';
import { Button } from './Button';

export interface ErrorAlertProps {
  /** 错误描述（调用方负责传入翻译后的文案） */
  message: string;
  /** 可选标题，如「加载失败」 */
  title?: string;
  /** 传入则渲染重试按钮 */
  onRetry?: () => void;
  /** 重试按钮文案 */
  retryLabel?: string;
  className?: string;
}

/** 统一的行内错误横幅：红色边框卡片 + 图标 + 可选重试按钮 */
export const ErrorAlert = memo(function ErrorAlert({
  message,
  title,
  onRetry,
  retryLabel,
  className,
}: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700',
        className
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        <p className="break-all">{message}</p>
      </div>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="shrink-0 text-red-600 hover:text-red-700"
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
});
