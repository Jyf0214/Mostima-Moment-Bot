import { memo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/ui';

export interface SuccessAlertProps {
  /** 成功描述（调用方负责传入翻译后的文案） */
  message: string;
  /** 可选标题 */
  title?: string;
  className?: string;
}

/** 统一的成功提示横幅：绿色系，与 ErrorAlert 视觉对称 */
export const SuccessAlert = memo(function SuccessAlert({
  message,
  title,
  className,
}: SuccessAlertProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700',
        className
      )}
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        <p className="break-all">{message}</p>
      </div>
    </div>
  );
});
