import { CheckResult } from './runner';
import { execSync } from 'child_process';

/**
 * 执行单个 CI 检查步骤
 */
export function executeCheckStep(
  name: string,
  command: string,
  workspaceDir: string
): CheckResult {
  const startTime = Date.now();

  try {
    execSync(command, {
      cwd: workspaceDir,
      stdio: 'pipe',
    });

    return {
      step: name,
      status: 'PASS',
      duration: Date.now() - startTime,
      exitCode: 0,
    };
  } catch (error: any) {
    return {
      step: name,
      status: 'FAIL',
      duration: Date.now() - startTime,
      output: error.stderr?.toString() || error.message,
      exitCode: error.status || 1,
    };
  }
}

/**
 * 创建 SKIP 结果
 */
export function createSkipResult(name: string): CheckResult {
  return {
    step: name,
    status: 'SKIP',
    duration: 0,
    exitCode: -1,
  };
}
