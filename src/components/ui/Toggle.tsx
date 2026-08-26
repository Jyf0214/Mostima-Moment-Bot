import { cn } from '@/lib/ui';

export interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  /** 无障碍标签（调用方负责传入翻译后的文案） */
  label?: string;
  className?: string;
}

/**
 * 统一的开关切换控件。
 * 此前仓库列表用 emerald h-6 w-11、详情页规则行用 purple h-5 w-9，
 * 同类控件两种规格两种色；本组件是全站唯一样式（开启 emerald，关闭 zinc）。
 */
export function Toggle({ checked, onChange, disabled, label, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-emerald-500' : 'bg-zinc-300',
        className
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  );
}
