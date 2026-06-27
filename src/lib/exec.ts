import { spawn, type SpawnOptions } from 'child_process';

/**
 * spawn 的返回结果
 */
export interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * 异步执行子进程（不经过 shell），防止命令注入
 *
 * 与 execSync/execFileSync 的区别：
 * - 使用 spawn 而非 exec，不启动 shell，参数不会被 shell 展开
 * - 返回 Promise，支持异步调用
 * - stdout/stderr 以字符串形式返回
 *
 * @param command 可执行文件路径
 * @param args 参数数组
 * @param options spawn 选项（cwd、env 等）
 */
export async function spawnAsync(
  command: string,
  args: string[],
  options?: SpawnOptions
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      ...options,
    });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
    }

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });
  });
}
