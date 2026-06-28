import { logger } from '../logger';
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

const QWEN_DIR = join(process.env.HOME || '/root', '.qwen');
const MAX_ATTEMPTS = 5;
const MAX_DURATION_MS = 1200_000; // 20 分钟

interface RunOptions {
  sessionId?: string;
  maxSessionTurns?: number;
  resume?: boolean;
  timeout?: number;
}

interface RunResult {
  success: boolean;
  output: string;
  sessionId: string;
  duration: number;
  attempts: number;
}

/**
 * 确保 ~/.qwen 目录存在
 */
function ensureQwenDir(): void {
  if (!existsSync(QWEN_DIR)) {
    mkdirSync(QWEN_DIR, { recursive: true });
  }
}

/**
 * 获取或创建持久化 Session ID
 */
export function getOrCreateSessionId(key: string): { sessionId: string; isResume: boolean } {
  ensureQwenDir();
  const sessionFile = join(QWEN_DIR, `session_${key}.txt`);

  if (existsSync(sessionFile)) {
    const sessionId = readFileSync(sessionFile, 'utf-8').trim();
    return { sessionId, isResume: true };
  }

  const sessionId = crypto.randomUUID();
  writeFileSync(sessionFile, sessionId, 'utf-8');
  return { sessionId, isResume: false };
}

/**
 * 配置 Qwen Settings
 */
export function configureSettings(): void {
  ensureQwenDir();
  const settingsPath = join(QWEN_DIR, 'settings.json');
  const settingsJson = process.env.QWEN_SETTINGS_JSON;
  if (settingsJson && !existsSync(settingsPath)) {
    writeFileSync(settingsPath, settingsJson, 'utf-8');
  }
}

/**
 * 创建 LSP 配置文件
 */
export function createLspConfig(workspaceDir: string): void {
  const lspPath = join(workspaceDir, '.lsp.json');
  if (!existsSync(lspPath)) {
    const config = {
      typescript: {
        command: 'typescript-language-server',
        args: ['--stdio'],
        extensionToLanguage: {
          '.ts': 'typescript',
          '.tsx': 'typescriptreact',
          '.js': 'javascript',
          '.jsx': 'javascriptreact',
        },
      },
    };
    writeFileSync(lspPath, JSON.stringify(config, null, 2), 'utf-8');
  }
}

/**
 * 注入 Git 钩子：禁止直推主分支
 */
export function injectBranchProtection(workspaceDir: string): void {
  const hooksDir = join(workspaceDir, '.git', 'hooks');
  if (!existsSync(hooksDir)) return;

  const hookContent = `#!/bin/sh
while read local_ref local_sha remote_ref remote_sha
do
  if [ "$remote_ref" = "refs/heads/main" ] || [ "$remote_ref" = "refs/heads/master" ]; then
    echo "========================================================="
    echo " [SECURITY ERROR] Direct push to main/master is PROHIBITED!"
    echo "========================================================="
    exit 1
  fi
done
exit 0
`;

  const hookPath = join(hooksDir, 'pre-push');
  writeFileSync(hookPath, hookContent, { mode: 0o755 });
}

/**
 * 执行 Qwen Code CLI（带自愈重试和会话持久化）
 *
 * 完整复原 ZhouZBoss-Web 的工作流规则：
 * - 首次使用 --session-id 创建新会话
 * - 后续使用 --resume 恢复会话
 * - 失败时自愈重试（最多 5 次）
 * - 超时或网络错误时触发压缩（/compress-fast, /compress）
 * - 通过位置参数传递 prompt，避免交互阻塞
 */
export async function runQwen(prompt: string, options: RunOptions = {}): Promise<RunResult> {
  const {
    sessionId: providedSessionId,
    maxSessionTurns = 100,
    resume: forceResume,
    timeout = 600_000,
  } = options;

  ensureQwenDir();
  configureSettings();

  const sessionId = providedSessionId || crypto.randomUUID();
  let isResume = forceResume ?? false;
  let attempt = 1;
  let success = false;
  let triggerCompression = false;
  let output = '';

  // 环境变量
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_PENDING_DEPRECATION: '0',
    QWEN_CODE_UNATTENDED_RETRY: '1',
    QWEN_CODE_SUPPRESS_YOLO_WARNING: '1',
    UNLIMITED_OPENAI_API_KEY: process.env.UNLIMITED_OPENAI_API_KEY || '',
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  };

  const startTime = Date.now();

  // 构建 qwen 命令参数
  function buildArgs(sessionId: string, promptArg: string, resumeMode: boolean): string[] {
    const args = [
      '-y',
      '--experimental-lsp',
      '--max-session-turns',
      String(maxSessionTurns),
      '--max-tool-calls',
      '-1',
    ];
    if (resumeMode) {
      args.push('--resume', sessionId, promptArg);
    } else {
      args.push('--session-id', sessionId, promptArg);
    }
    return args;
  }

  // 执行单次 qwen 调用（使用 execFileSync 避免 shell 展开风险）
  function executeQwen(args: string[]): { ok: boolean; output: string } {
    try {
      const result = execFileSync('qwen', args, {
        env,
        timeout,
        maxBuffer: 50 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8',
      });
      return { ok: true, output: result };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      return { ok: false, output: err.stdout || err.stderr || err.message || '' };
    }
  }

  // 首次执行
  logger.info(`[Qwen Runner] Starting (session: ${sessionId}, resume: ${isResume})...`);
  let result = executeQwen(buildArgs(sessionId, prompt, isResume));
  output = result.output;

  if (result.ok) {
    success = true;
  } else {
    const duration = Date.now() - startTime;
    logger.warn(`[Qwen Runner] Initial run failed. Duration: ${duration}ms`);
    if (duration >= MAX_DURATION_MS || /524|terminated|closed/i.test(output)) {
      triggerCompression = true;
    }
  }

  // 自愈重试循环
  while (!success && attempt < MAX_ATTEMPTS) {
    attempt++;
    logger.info(`[Qwen Runner] Self-healing attempt ${attempt}/${MAX_ATTEMPTS}...`);
    await sleep(15_000);

    // 压缩机制
    if (triggerCompression) {
      if (attempt === 2) {
        logger.info('[Qwen Runner] Attempt 2: running /compress-fast...');
        executeQwen(buildArgs(sessionId, '/compress-fast', true));
      } else if (attempt >= 3) {
        logger.info(`[Qwen Runner] Attempt ${attempt}: running /compress-fast + /compress...`);
        executeQwen(buildArgs(sessionId, '/compress-fast', true));
        await sleep(5_000);
        executeQwen(buildArgs(sessionId, '/compress', true));
      }
    }

    // 弹性恢复
    const resumePrompt =
      '由于网络或上下文限制中断，请继续完成所有步骤。对照 todo_checklist.md 继续修复未打勾的项，通过测试后完成代码提交与 PR。';
    const retryStart = Date.now();
    result = executeQwen(buildArgs(sessionId, resumePrompt, true));
    output = result.output;

    if (result.ok) {
      success = true;
      logger.info('[Qwen Runner] Self-healing succeeded.');
    } else {
      const duration = Date.now() - retryStart;
      logger.warn(`[Qwen Runner] Attempt ${attempt} failed. Duration: ${duration}ms`);
      if (duration >= MAX_DURATION_MS || /524|terminated|closed/i.test(output)) {
        triggerCompression = true;
      }
    }
  }

  return {
    success,
    output,
    sessionId,
    duration: Date.now() - startTime,
    attempts: attempt,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
