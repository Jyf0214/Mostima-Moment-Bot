/**
 * CI 日志收集器
 *
 * 模仿 GitHub Actions 的 Step-based 日志结构：
 * - 每个 CI 运行包含多个 Step
 * - 每个 Step 记录：名称、命令、状态、输出、耗时、时间戳
 * - 支持子步骤（sub-steps）嵌套
 * - 结构化 JSON 存储，前端可解析渲染
 */

/** 单个步骤的状态 */
export type StepStatus = 'queued' | 'in_progress' | 'completed';

/** 单个步骤的结论 */
export type StepConclusion = 'success' | 'failure' | 'skipped' | 'cancelled' | null;

/** 单个日志步骤 */
export interface LogStep {
  name: string;
  command?: string;
  status: StepStatus;
  conclusion?: StepConclusion;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  output?: string;
  subSteps?: LogStep[];
}

/** 完整的结构化日志数据 */
export interface LogData {
  version: 1;
  steps: LogStep[];
}

/** 输出截断阈值：单步输出最大 30KB */
const MAX_STEP_OUTPUT = 30000;

/** 总日志最大 48KB（留 2KB 余量给 JSON 结构） */
const MAX_TOTAL_LOGS = 48000;

/**
 * CI 日志收集器
 *
 * 用法：
 * ```ts
 * const logger = new LogCollector();
 * logger.startStep('Dependencies', 'npm ci');
 * // ... 执行命令 ...
 * logger.finishStep('Dependencies', { conclusion: 'success', output: stdout });
 * const json = logger.toJSON();
 * ```
 */
export class LogCollector {
  private steps: LogStep[] = [];
  private stepStack: LogStep[] = [];

  /** 开始一个步骤 */
  startStep(name: string, command?: string): void {
    const step: LogStep = {
      name,
      command,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    };

    if (this.stepStack.length > 0) {
      const parent = this.stepStack[this.stepStack.length - 1];
      if (!parent.subSteps) parent.subSteps = [];
      parent.subSteps.push(step);
    } else {
      this.steps.push(step);
    }

    this.stepStack.push(step);
  }

  /** 追加输出到当前步骤 */
  appendOutput(text: string): void {
    const current = this.stepStack[this.stepStack.length - 1];
    if (!current) return;

    const truncated = text.slice(0, MAX_STEP_OUTPUT);
    if (current.output) {
      current.output += truncated;
      if (current.output.length > MAX_STEP_OUTPUT) {
        current.output = current.output.slice(-MAX_STEP_OUTPUT);
      }
    } else {
      current.output = truncated;
    }
  }

  /** 完成当前步骤 */
  finishStep(
    name: string,
    opts: { conclusion?: StepConclusion; output?: string; exitCode?: number } = {}
  ): void {
    const idx = this.stepStack.findIndex((s) => s.name === name);
    if (idx === -1) return;

    const step = this.stepStack[idx];
    step.status = 'completed';
    step.conclusion = opts.conclusion ?? 'success';
    step.completedAt = new Date().toISOString();
    step.durationMs = new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime();

    if (opts.output !== undefined) {
      step.output = opts.output.slice(0, MAX_STEP_OUTPUT);
    }

    // 弹出栈中该步骤及所有子步骤
    this.stepStack.splice(idx);
  }

  /** 快捷方法：执行并完成一个步骤（适用于同步命令） */
  runStep(
    name: string,
    command: string,
    fn: () => { stdout?: string; stderr?: string; exitCode: number }
  ): { stdout?: string; stderr?: string; exitCode: number } {
    this.startStep(name, command);
    try {
      const result = fn();
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
      this.finishStep(name, {
        conclusion: result.exitCode === 0 ? 'success' : 'failure',
        output: output || undefined,
      });
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.finishStep(name, { conclusion: 'failure', output: msg });
      return { stderr: msg, exitCode: 1 };
    }
  }

  /** 追加纯文本消息（作为子步骤） */
  addMessage(text: string): void {
    const step: LogStep = {
      name: text,
      status: 'completed',
      conclusion: 'success',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
    };

    if (this.stepStack.length > 0) {
      const parent = this.stepStack[this.stepStack.length - 1];
      if (!parent.subSteps) parent.subSteps = [];
      parent.subSteps.push(step);
    } else {
      this.steps.push(step);
    }
  }

  /** 序列化为 JSON 字符串（限制总大小） */
  toJSON(): string {
    const data: LogData = { version: 1, steps: this.steps };
    let json = JSON.stringify(data, null, 2);
    if (json.length > MAX_TOTAL_LOGS) {
      // 截断最早的步骤输出
      for (const step of this.steps) {
        if (step.output && step.output.length > 1000) {
          step.output = '...\n' + step.output.slice(-1000);
        }
        if (step.subSteps) {
          for (const sub of step.subSteps) {
            if (sub.output && sub.output.length > 500) {
              sub.output = '...\n' + sub.output.slice(-500);
            }
          }
        }
      }
      json = JSON.stringify(data, null, 2);
      if (json.length > MAX_TOTAL_LOGS) {
        json = json.slice(0, MAX_TOTAL_LOGS);
      }
    }
    return json;
  }

  /** 获取步骤列表（用于调试） */
  getSteps(): LogStep[] {
    return this.steps;
  }
}
