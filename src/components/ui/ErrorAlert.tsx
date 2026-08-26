import { memo, useState } from 'react';
import { AlertTriangle, Check, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/ui';
import { copyTextToClipboard } from '@/lib/clipboard';
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

/** 统一的行内错误横幅：红色边框卡片 + 图标 + 一键复制 + 可选重试按钮 */
export const ErrorAlert = memo(function ErrorAlert({
  message,
  title,
  onRetry,
  retryLabel,
  className,
}: ErrorAlertProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(message);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

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
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={handleCopy}
          title={copied ? t('common.copied') : t('common.copyError')}
          aria-label={copied ? t('common.copied') : t('common.copyError')}
          className={cn(
            'rounded-md p-1.5 transition-colors hover:bg-red-100',
            copied ? 'text-emerald-600' : 'text-red-600'
          )}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
        {onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="text-red-600 hover:text-red-700"
          >
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  );
});
