import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, ChevronRight, Clock, Copy, Loader2 } from 'lucide-react';
import { copyTextToClipboard } from '@/lib/clipboard';
import { formatDuration } from '@/lib/time';
import { buildStepKey, CONCLUSION_CONFIG, type LogStep } from './common';

/** 带时间线的步骤组件（递归渲染子步骤） */
export function StepTimeline({
  step,
  index,
  total,
  prefix,
  expandedSet,
  onToggle,
}: {
  step: LogStep;
  index: number;
  total: number;
  /** 层级前缀：顶层为空串，子步骤传父级 key + '/' */
  prefix: string;
  expandedSet: Set<string>;
  onToggle: (key: string) => void;
}) {
  const { t } = useTranslation();
  const [outputCopied, setOutputCopied] = useState(false);
  const stepKey = buildStepKey(prefix, step.name, index);
  const expanded = expandedSet.has(stepKey);
  const conclusion = step.conclusion || (step.status === 'completed' ? 'success' : null);
  const cfg = conclusion ? CONCLUSION_CONFIG[conclusion] : null;
  const isLast = index === total - 1;
  const hasSubSteps = step.subSteps && step.subSteps.length > 0;
  const hasOutput = !!step.output;
  const isExpandable = hasSubSteps || hasOutput;

  const StatusIcon = cfg?.icon || (step.status === 'in_progress' ? Loader2 : Clock);
  const statusColor =
    cfg?.color || (step.status === 'in_progress' ? 'text-blue-500' : 'text-zinc-400');

  return (
    <div className="relative flex gap-3">
      {/* 时间线连接器 */}
      <div className="flex flex-col items-center shrink-0">
        {/* 状态圆点 */}
        <div
          className={`relative z-10 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
            cfg ? cfg.bg : 'bg-zinc-100'
          } ring-2 ${cfg ? cfg.borderColor : 'ring-zinc-200'}`}
        >
          <StatusIcon
            className={`h-4 w-4 ${statusColor} ${
              step.status === 'in_progress' ? 'animate-spin' : ''
            }`}
          />
        </div>
        {/* 连接线 */}
        {!isLast && (
          <div
            className={`w-0.5 flex-1 min-h-4 ${
              conclusion === 'failure' ? 'bg-red-200' : 'bg-zinc-200'
            }`}
          />
        )}
      </div>

      {/* 步骤内容 */}
      <div className={`flex-1 pb-4 ${isLast ? 'pb-0' : ''}`}>
        {/* 步骤头部 */}
        <button
          onClick={() => isExpandable && onToggle(stepKey)}
          className={`w-full text-left group ${isExpandable ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              isExpandable ? 'hover:bg-zinc-50 group-hover:bg-zinc-50' : ''
            }`}
          >
            {/* 展开/折叠箭头 */}
            {isExpandable ? (
              expanded ? (
                <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
              )
            ) : (
              <div className="w-4 shrink-0" />
            )}

            {/* 步骤名称 */}
            <span
              className={`text-sm font-medium flex-1 min-w-0 truncate ${
                conclusion === 'failure'
                  ? 'text-red-700'
                  : conclusion === 'success'
                    ? 'text-zinc-900'
                    : 'text-zinc-600'
              }`}
            >
              {step.name}
            </span>

            {/* 命令标签 */}
            {step.command && (
              <code className="text-[10px] text-zinc-400 font-mono bg-zinc-100 px-2 py-0.5 rounded shrink-0 hidden sm:inline max-w-[200px] truncate">
                {step.command}
              </code>
            )}

            {/* 耗时 */}
            {step.durationMs != null && step.durationMs > 0 && (
              <span className="text-[10px] text-zinc-400 shrink-0 tabular-nums">
                {formatDuration(step.durationMs)}
              </span>
            )}

            {/* 状态徽章 */}
            {conclusion && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${
                  cfg ? `${cfg.bg} ${cfg.color}` : 'bg-zinc-100 text-zinc-500'
                }`}
              >
                {conclusion === 'success'
                  ? 'OK'
                  : conclusion === 'failure'
                    ? 'FAIL'
                    : conclusion === 'skipped'
                      ? 'SKIP'
                      : conclusion}
              </span>
            )}
          </div>
        </button>

        {/* 展开内容 */}
        {expanded && (
          <div className="ml-2 mt-1 space-y-2">
            {/* 子步骤 */}
            {hasSubSteps && (
              <div className="space-y-0">
                {step.subSteps!.map((sub, i) => (
                  <StepTimeline
                    key={buildStepKey(`${stepKey}/`, sub.name, i)}
                    step={sub}
                    index={i}
                    total={step.subSteps!.length}
                    prefix={`${stepKey}/`}
                    expandedSet={expandedSet}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            )}

            {/* 输出 */}
            {hasOutput && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-200 bg-zinc-100/50">
                  <span className="text-[10px] text-zinc-500 font-medium">
                    {t('runDetail.output')}
                  </span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await copyTextToClipboard(step.output || '');
                      if (!ok) return; // 小图标场景复制失败静默即可
                      setOutputCopied(true);
                      setTimeout(() => setOutputCopied(false), 2000);
                    }}
                    className="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    {outputCopied ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
                <pre className="p-3 text-xs text-zinc-700 font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                  {step.output}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
