import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  CheckCircle2,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  SkipForward,
  XCircle,
} from 'lucide-react';
import { formatDuration } from '@/lib/time';
import { buildStepKey, collectExpandableKeys, type LogData } from './common';
import { StepTimeline } from './StepTimeline';

/** 结构化日志渲染：摘要栏 + 可折叠步骤时间线 */
export function StructuredLogs({
  logData,
  onCopy,
  copied,
}: {
  logData: LogData;
  onCopy: () => void;
  copied: boolean;
}) {
  const { t } = useTranslation();
  const [expandedSet, setExpandedSet] = useState<Set<string>>(() => {
    // 默认展开所有有输出或子步骤的步骤
    const all = new Set<string>();
    collectExpandableKeys(logData.steps, '', all);
    return all;
  });
  const [allExpanded, setAllExpanded] = useState(true);

  const successCount = logData.steps.filter((s) => s.conclusion === 'success').length;
  const failCount = logData.steps.filter((s) => s.conclusion === 'failure').length;
  const skipCount = logData.steps.filter((s) => s.conclusion === 'skipped').length;

  // 计算总耗时
  const totalDurationMs = logData.steps.reduce((acc, s) => acc + (s.durationMs || 0), 0);

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedSet(new Set());
    } else {
      const all = new Set<string>();
      collectExpandableKeys(logData.steps, '', all);
      setExpandedSet(all);
    }
    setAllExpanded(!allExpanded);
  };

  const toggleStep = (key: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div>
      {/* 摘要栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-zinc-500 font-medium">
            {t('runDetail.stepsCount', { count: logData.steps.length })}
          </span>
          {totalDurationMs > 0 && (
            <span className="text-zinc-400 tabular-nums">{formatDuration(totalDurationMs)}</span>
          )}
          {successCount > 0 && (
            <span className="text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> {successCount} {t('runDetail.passed')}
            </span>
          )}
          {failCount > 0 && (
            <span className="text-red-500 flex items-center gap-1">
              <XCircle className="h-3 w-3" /> {failCount} {t('runDetail.failed')}
            </span>
          )}
          {skipCount > 0 && (
            <span className="text-zinc-400 flex items-center gap-1">
              <SkipForward className="h-3 w-3" /> {skipCount} {t('runDetail.skipped')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAll}
            className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            {allExpanded ? (
              <>
                <ChevronsDownUp className="h-3 w-3" />
                {t('runDetail.collapseAll')}
              </>
            ) : (
              <>
                <ChevronsUpDown className="h-3 w-3" />
                {t('runDetail.expandAll')}
              </>
            )}
          </button>
          <button
            onClick={onCopy}
            className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                {t('apiKey.copied')}
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                {t('runDetail.copyJson')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* 步骤时间线 */}
      <div>
        {logData.steps.map((step, i) => (
          <StepTimeline
            key={buildStepKey('', step.name, i)}
            step={step}
            index={i}
            total={logData.steps.length}
            prefix=""
            expandedSet={expandedSet}
            onToggle={toggleStep}
          />
        ))}
      </div>
    </div>
  );
}
