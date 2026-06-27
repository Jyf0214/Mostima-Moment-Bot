import { execFileSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  runQwen,
  getOrCreateSessionId,
  injectBranchProtection,
  createLspConfig,
} from '../qwen/runner';
import { postPRComment } from '../github/api';
import { buildScanPrompt, SCAN_RESUME_PROMPT, DEEP_SCAN_PROMPT } from '../qwen/prompts';
import { validateBranchName } from '../git/workspace';

/**
 * 定时安全扫描服务
 *
 * 完整复原 ZhouZBoss-Web qwen-scheduled-scanner.yml 规则：
 * - 基于并行 Subagent 的分布式深度排查
 * - 多阶段执行：并行审计 → 任务墙 → 并行自愈 → PR 出库
 * - todo_checklist.md 清单销项
 * - 极深度底层漏洞会诊（首轮耗时 < 20 分钟时触发）
 * - 自愈断点续传 + 压缩机制
 * - LLM Judge 终态硬红线判定
 *
 * 安全措施：
 * - 所有 git/gh 命令使用 execFileSync（不经过 shell）
 * - scanBranch 通过 validateBranchName 校验
 * - gh pr create 的 --body 使用 execFileSync 数组参数传递，避免 shell 注入
 */
export async function runScheduledScan(workspaceDir: string): Promise<void> {
  console.log('[Scheduled Scanner] Starting weekly deep scan...');

  // 1. 分支保护 + LSP
  injectBranchProtection(workspaceDir);
  createLspConfig(workspaceDir);

  // 2. 会话持久化
  const { sessionId, isResume } = getOrCreateSessionId('scheduled-scan');

  // 3. 获取最新代码
  try {
    execFileSync('git', ['fetch', 'origin', 'main'], { cwd: workspaceDir, stdio: 'pipe' });
    execFileSync('git', ['checkout', 'main'], { cwd: workspaceDir, stdio: 'pipe' });
    execFileSync('git', ['pull', 'origin', 'main'], { cwd: workspaceDir, stdio: 'pipe' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Scheduled Scanner] Failed to update main: ${msg}`);
    return;
  }

  // 4. 创建巡检分支
  const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const scanBranch = validateBranchName(`scheduled/audit-patch-${currentDate}`);

  try {
    execFileSync('git', ['checkout', '-b', scanBranch], { cwd: workspaceDir, stdio: 'pipe' });
  } catch {
    execFileSync('git', ['checkout', scanBranch], { cwd: workspaceDir, stdio: 'pipe' });
  }

  // 5. 构建 Prompt
  const prompt = buildScanPrompt(currentDate);

  // 6. 执行第一轮扫描
  const startTime = Date.now();
  const result = await runQwen(prompt, {
    sessionId,
    maxSessionTurns: 150,
    resume: isResume,
  });

  if (!result.success) {
    console.error(`[Scheduled Scanner] First round failed after ${result.attempts} attempts`);
    return;
  }

  const firstDuration = Date.now() - startTime;
  console.log(`[Scheduled Scanner] First round completed in ${firstDuration}ms`);

  // 7. 极深度会诊（首轮耗时 < 20 分钟时触发）
  if (firstDuration < 1_200_000) {
    console.log('[Scheduled Scanner] First round too fast, triggering deep scan...');

    await runQwen(DEEP_SCAN_PROMPT, {
      sessionId,
      maxSessionTurns: 150,
      resume: true,
    });
  }

  // 8. 提交并推送
  try {
    execFileSync('git', ['add', '-A'], { cwd: workspaceDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', `chore: scheduled security scan ${currentDate}`, '--allow-empty'], {
      cwd: workspaceDir,
      stdio: 'pipe',
    });
    execFileSync('git', ['push', 'origin', scanBranch], { cwd: workspaceDir, stdio: 'pipe' });

    // 9. 创建 PR — 使用 execFileSync 数组参数避免 shell 注入
    const checklistFile = join(workspaceDir, 'todo_checklist.md');
    let prBody = `## Scheduled Security Scan Report (${currentDate})\n\n`;
    prBody += `> Automated scan by Qwen Code multi-agent system\n\n`;

    if (existsSync(checklistFile)) {
      const checklist = readFileSync(checklistFile, 'utf-8');
      prBody += '### Findings\n\n' + checklist;
    }

    try {
      execFileSync(
        'gh',
        [
          'pr', 'create',
          '--title', `chore: scheduled scan ${currentDate}`,
          '--body', prBody,
          '--head', scanBranch,
          '--base', 'main',
        ],
        { cwd: workspaceDir, stdio: 'pipe' }
      );
    } catch {
      // PR 已存在
    }

    console.log(`[Scheduled Scanner] Scan completed. Branch: ${scanBranch}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Scheduled Scanner] Push failed: ${msg}`);
  }
}
