import { CheckResult } from './runner';
import { spawnAsync } from '../exec';
import type { LogCollector } from './log-collector';

/**
 * CI 检查步骤默认超时时间：10 分钟
 * 可通过环境变量 CI_STEP_TIMEOUT_MS 自定义（毫秒）
 */
const DEFAULT_STEP_TIMEOUT = 600_000;
const STEP_TIMEOUT_MS = parseInt(process.env.CI_STEP_TIMEOUT_MS || '', 10) || DEFAULT_STEP_TIMEOUT;

/**
 * 允许执行的命令白名单
 *
 * 仅允许 CI 管线中预定义的安全命令，防止任意命令注入。
 * 如果需要新增命令，必须在此处显式添加。
 */
const ALLOWED_COMMANDS: ReadonlyMap<string, [program: string, args: string[]]> = new Map([
  ['npm ci', ['npm', ['ci']]],
  ['npm run lint', ['npm', ['run', 'lint']]],
  ['npx tsc --noEmit', ['npx', ['tsc', '--noEmit']]],
  ['npm run build', ['npm', ['run', 'build']]],
]);

/**
 * 执行单个 CI 检查步骤
 *
 * 安全措施：
 * 1. 命令白名单校验 — 只允许 runner.ts 中预定义的命令
 * 2. 使用 spawnAsync 数组参数 — 不经过 shell 展开
 *
 * 必须异步执行：此前用 execFileSync 同步等待（单步最长 10 分钟），
 * 会冻结整个 Node 事件循环，期间健康检查、其他 webhook、仪表盘全部无响应
 */
export async function executeCheckStep(
  name: string,
  command: string,
  workspaceDir: string,
  logCollector?: LogCollector
): Promise<CheckResult> {
  const startTime = Date.now();

  // 白名单校验：拒绝未授权的命令
  const allowed = ALLOWED_COMMANDS.get(command);
  if (!allowed) {
    const output = `Command not allowed: ${command}`;
    logCollector?.startStep(name, command);
    logCollector?.finishStep(name, { conclusion: 'failure', output });
    return {
      step: name,
      status: 'FAIL',
      duration: Date.now() - startTime,
      output,
      exitCode: 1,
    };
  }

  logCollector?.startStep(name, command);

  try {
    const [program, args] = allowed;
    const result = await spawnAsync(program, args, {
      cwd: workspaceDir,
      timeout: STEP_TIMEOUT_MS,
    });

    if (result.exitCode === 0) {
      logCollector?.finishStep(name, { conclusion: 'success', output: result.stdout || undefined });
      return {
        step: name,
        status: 'PASS',
        duration: Date.now() - startTime,
        exitCode: 0,
      };
    }

    const output = result.stderr || result.stdout || `Exit code: ${result.exitCode}`;
    logCollector?.finishStep(name, { conclusion: 'failure', output });
    return {
      step: name,
      status: 'FAIL',
      duration: Date.now() - startTime,
      output,
      exitCode: result.exitCode || 1,
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    const output = err.message || 'Check step failed';
    logCollector?.finishStep(name, { conclusion: 'failure', output });
    return {
      step: name,
      status: 'FAIL',
      duration: Date.now() - startTime,
      output,
      exitCode: 1,
    };
  }
}

/**
 * 创建 SKIP 结果
 */
export function createSkipResult(name: string, logCollector?: LogCollector): CheckResult {
  logCollector?.startStep(name);
  logCollector?.finishStep(name, { conclusion: 'skipped' });
  return {
    step: name,
    status: 'SKIP',
    duration: 0,
    exitCode: -1,
  };
}
