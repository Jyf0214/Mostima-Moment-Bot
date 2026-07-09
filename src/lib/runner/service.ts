/**
 * GitHub Actions 自托管 Runner 服务
 *
 * 负责 Runner 的全生命周期管理：
 * - 从 GitHub API 获取注册令牌
 * - 配置和注册 Runner
 * - 通过 PM2 启动/停止 Runner 进程
 * - 监控 Runner 状态
 */

import { execSync, exec as execCb } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getAppId, getPrivateKey, generateJWT } from '@/lib/github/auth';

const execAsync = promisify(execCb);

// Runner 二进制文件路径
const RUNNER_HOME = process.env.RUNNER_HOME || '/home/node/actions-runner';

// Runner 状态常量
export const RUNNER_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  STOPPED: 'stopped',
  ERROR: 'error',
  OFFLINE: 'offline',
} as const;

export type RunnerStatus = (typeof RUNNER_STATUS)[keyof typeof RUNNER_STATUS];

export interface RunnerInfo {
  id: number;
  name: string;
  scopeType: string;
  scopeTarget: string;
  labels: string[];
  status: RunnerStatus;
  runnerId: number | null;
  pid: number | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 获取 GitHub Installation Access Token
 * 用于调用 GitHub Actions Runner API
 */
async function getInstallationAccessToken(installationId?: number): Promise<string> {
  const appId = await getAppId();
  const privateKey = await getPrivateKey();
  const appJwt = generateJWT(appId, privateKey);

  // 获取安装列表
  const installationsRes = await fetch('https://api.github.com/app/installations', {
    headers: {
      Authorization: `Bearer ${appJwt}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!installationsRes.ok) {
    throw new Error(`Failed to get installations: ${installationsRes.statusText}`);
  }

  const installations = (await installationsRes.json()) as Array<{ id: number }>;

  // 优先使用指定的 installationId，否则使用第一个
  const targetId = installationId || (installations.length > 0 ? installations[0].id : null);

  if (!targetId) {
    throw new Error('No GitHub App installation found');
  }

  // 获取 Access Token
  const tokenRes = await fetch(
    `https://api.github.com/app/installations/${targetId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!tokenRes.ok) {
    throw new Error(`Failed to get installation access token: ${tokenRes.statusText}`);
  }

  const tokenData = (await tokenRes.json()) as { token: string };
  return tokenData.token;
}

/**
 * 获取 Runner 注册令牌
 * 通过 GitHub API 获取用于注册 Runner 的临时令牌
 */
export async function getRegistrationToken(
  scopeType: 'repo' | 'org',
  scopeTarget: string,
  installationId?: number
): Promise<string> {
  const token = await getInstallationAccessToken(installationId);

  let url: string;
  if (scopeType === 'org') {
    url = `https://api.github.com/orgs/${scopeTarget}/actions/runners/registration-token`;
  } else {
    // scopeType === 'repo', scopeTarget 格式为 "owner/repo"
    url = `https://api.github.com/repos/${scopeTarget}/actions/runners/registration-token`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Failed to get registration token for ${scopeType}/${scopeTarget}: ${res.status} ${body}`
    );
  }

  const data = (await res.json()) as { token: string; expires_at: string };
  logger.info(
    `[Runner] Registration token obtained for ${scopeType}/${scopeTarget}, expires: ${data.expires_at}`
  );
  return data.token;
}

/**
 * 注册 Runner
 * 配置 GitHub Actions Runner 二进制文件并完成注册
 */
export async function registerRunner(runnerId: number): Promise<void> {
  const runner = await prisma.gitHubRunner.findUnique({ where: { id: runnerId } });
  if (!runner) throw new Error(`Runner ${runnerId} not found`);

  // 获取注册令牌
  const regToken = await getRegistrationToken(
    runner.scopeType as 'repo' | 'org',
    runner.scopeTarget,
    runner.installationId || undefined
  );

  // 创建 Runner 工作目录
  const workDir = path.join('/tmp', `runner-${runner.id}`);
  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }

  // 复制 Runner 二进制文件到工作目录
  const runnerSrc = RUNNER_HOME;
  if (fs.existsSync(runnerSrc)) {
    execSync(`cp -r ${runnerSrc}/* ${workDir}/`, { timeout: 30000 });
  } else {
    throw new Error(
      `GitHub Actions Runner binary not found at ${runnerSrc}. Please ensure it is installed in the Docker image.`
    );
  }

  // 配置 Runner
  const labels = runner.labels.join(',');
  const configCmd = [
    `cd ${workDir}`,
    `&& ./config`,
    `--url https://github.com/${runner.scopeType === 'org' ? runner.scopeTarget : runner.scopeTarget}`,
    `--token "${regToken}"`,
    `--name "${runner.name}"`,
    `--labels "${labels}"`,
    `--work "${workDir}/_work"`,
    `--replace`,
    `--unattended`,
  ].join(' ');

  try {
    await execAsync(configCmd, { timeout: 60000 });
    logger.info(`[Runner] Runner ${runner.id} configured successfully in ${workDir}`);

    // 更新数据库
    await prisma.gitHubRunner.update({
      where: { id: runnerId },
      data: {
        workDir,
        status: RUNNER_STATUS.IDLE,
        lastError: null,
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[Runner] Failed to configure runner ${runnerId}:`, errorMsg);
    await prisma.gitHubRunner.update({
      where: { id: runnerId },
      data: { status: RUNNER_STATUS.ERROR, lastError: errorMsg },
    });
    throw err;
  }
}

/**
 * 启动 Runner
 * 通过 PM2 启动 GitHub Actions Runner 进程
 */
export async function startRunner(runnerId: number): Promise<void> {
  const runner = await prisma.gitHubRunner.findUnique({ where: { id: runnerId } });
  if (!runner) throw new Error(`Runner ${runnerId} not found`);

  if (runner.status === RUNNER_STATUS.RUNNING) {
    logger.info(`[Runner] Runner ${runner.id} is already running`);
    return;
  }

  // 如果没有工作目录，先注册
  if (!runner.workDir || !fs.existsSync(runner.workDir)) {
    await registerRunner(runnerId);
    // 重新获取更新后的数据
    const updated = await prisma.gitHubRunner.findUnique({ where: { id: runnerId } });
    if (!updated?.workDir) {
      throw new Error(`Runner ${runnerId} registration failed`);
    }
  }

  const workDir = runner.workDir!;

  // 检查 PM2 是否安装
  try {
    execSync('pm2 --version', { timeout: 5000 });
  } catch {
    throw new Error('PM2 is not installed. Please install pm2 globally.');
  }

  // 通过 PM2 启动 Runner
  const pm2Name = `gh-runner-${runner.id}`;
  const startCmd = `pm2 start ${workDir}/run.sh --name "${pm2Name}" --cwd "${workDir}" --time`;

  try {
    const result = await execAsync(startCmd, { timeout: 30000 });
    logger.info(`[Runner] PM2 start output: ${result.stdout}`);

    // 获取 PM2 进程 ID
    const listResult = await execAsync(`pm2 jlist`, { timeout: 10000 });
    const processes = JSON.parse(listResult.stdout) as Array<{
      name: string;
      pm_id: number;
    }>;
    const pm2Process = processes.find((p) => p.name === pm2Name);
    const pid = pm2Process?.pm_id ?? null;

    await prisma.gitHubRunner.update({
      where: { id: runnerId },
      data: {
        status: RUNNER_STATUS.RUNNING,
        pid,
        lastError: null,
      },
    });

    logger.info(`[Runner] Runner ${runner.id} started with PM2 name: ${pm2Name}, pid: ${pid}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[Runner] Failed to start runner ${runnerId}:`, errorMsg);
    await prisma.gitHubRunner.update({
      where: { id: runnerId },
      data: { status: RUNNER_STATUS.ERROR, lastError: errorMsg },
    });
    throw err;
  }
}

/**
 * 停止 Runner
 * 通过 PM2 停止 Runner 进程
 */
export async function stopRunner(runnerId: number): Promise<void> {
  const runner = await prisma.gitHubRunner.findUnique({ where: { id: runnerId } });
  if (!runner) throw new Error(`Runner ${runnerId} not found`);

  const pm2Name = `gh-runner-${runner.id}`;

  try {
    await execAsync(`pm2 stop ${pm2Name}`, { timeout: 15000 });
    await execAsync(`pm2 delete ${pm2Name}`, { timeout: 15000 });
  } catch {
    // PM2 进程可能已不存在，忽略错误
  }

  // 取消 Runner 注册（如果需要）
  if (runner.workDir && fs.existsSync(runner.workDir)) {
    try {
      const removeCmd = `cd ${runner.workDir} && ./config remove --token "${runner.runnerToken || ''}" --unattended`;
      await execAsync(removeCmd, { timeout: 30000 });
    } catch {
      // Runner 可能已经从 GitHub 端移除，忽略
    }

    // 清理工作目录
    try {
      fs.rmSync(runner.workDir, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  }

  await prisma.gitHubRunner.update({
    where: { id: runnerId },
    data: {
      status: RUNNER_STATUS.STOPPED,
      pid: null,
      workDir: null,
      runnerToken: null,
      registrationToken: null,
    },
  });

  logger.info(`[Runner] Runner ${runnerId} stopped and cleaned up`);
}

/**
 * 删除 Runner
 * 停止进程、清理工作目录、从 GitHub 移除
 */
export async function deleteRunner(runnerId: number): Promise<void> {
  const runner = await prisma.gitHubRunner.findUnique({ where: { id: runnerId } });
  if (!runner) throw new Error(`Runner ${runnerId} not found`);

  // 如果正在运行，先停止
  if (runner.status === RUNNER_STATUS.RUNNING) {
    await stopRunner(runnerId);
  }

  // 如果有工作目录残留，清理
  if (runner.workDir && fs.existsSync(runner.workDir)) {
    try {
      fs.rmSync(runner.workDir, { recursive: true, force: true });
    } catch {
      // 忽略
    }
  }

  await prisma.gitHubRunner.delete({ where: { id: runnerId } });
  logger.info(`[Runner] Runner ${runnerId} deleted`);
}

/**
 * 刷新 Runner 状态
 * 从 PM2 获取实际进程状态并同步到数据库
 */
export async function refreshRunnerStatus(runnerId: number): Promise<RunnerStatus> {
  const runner = await prisma.gitHubRunner.findUnique({ where: { id: runnerId } });
  if (!runner) throw new Error(`Runner ${runnerId} not found`);

  // 如果没有 PID 或不在运行状态，直接返回
  if (runner.status === RUNNER_STATUS.STOPPED || runner.status === RUNNER_STATUS.OFFLINE) {
    return runner.status as RunnerStatus;
  }

  const pm2Name = `gh-runner-${runner.id}`;

  try {
    const result = await execAsync(`pm2 jlist`, { timeout: 10000 });
    const processes = JSON.parse(result.stdout) as Array<{
      name: string;
      pm2_env: { status: string };
    }>;
    const pm2Process = processes.find((p) => p.name === pm2Name);

    let newStatus: RunnerStatus;
    if (!pm2Process) {
      newStatus = RUNNER_STATUS.OFFLINE;
    } else if (pm2Process.pm2_env.status === 'online') {
      newStatus =
        runner.status === RUNNER_STATUS.ERROR
          ? RUNNER_STATUS.IDLE
          : (runner.status as RunnerStatus);
    } else {
      newStatus = RUNNER_STATUS.OFFLINE;
    }

    if (newStatus !== runner.status) {
      await prisma.gitHubRunner.update({
        where: { id: runnerId },
        data: { status: newStatus },
      });
    }

    return newStatus;
  } catch {
    return runner.status as RunnerStatus;
  }
}

/**
 * 重新注册 Runner
 * 清除旧的注册信息并重新配置
 */
export async function reregisterRunner(runnerId: number): Promise<void> {
  const runner = await prisma.gitHubRunner.findUnique({ where: { id: runnerId } });
  if (!runner) throw new Error(`Runner ${runnerId} not found`);

  // 如果正在运行，先停止
  if (runner.status === RUNNER_STATUS.RUNNING) {
    await stopRunner(runnerId);
  }

  // 清除旧的注册信息
  await prisma.gitHubRunner.update({
    where: { id: runnerId },
    data: {
      workDir: null,
      runnerToken: null,
      registrationToken: null,
      pid: null,
      status: RUNNER_STATUS.STOPPED,
      lastError: null,
    },
  });

  // 重新注册并启动
  await registerRunner(runnerId);
  await startRunner(runnerId);
}

/**
 * 启动时自动恢复 Runner
 * 查询数据库中状态为 running 的 Runner，逐个重新注册并启动
 * 任何单个 Runner 失败不影响其他 Runner 的恢复
 */
export async function restoreRunners(): Promise<void> {
  // 检查 PM2 是否可用
  try {
    execSync('pm2 --version', { timeout: 5000 });
  } catch {
    logger.warn('[Runner] PM2 not installed, skipping runner auto-restore');
    return;
  }

  // 查找之前运行中或空闲的 Runner（容器重启后这些 Runner 需要重新注册）
  const runners = await prisma.gitHubRunner.findMany({
    where: {
      status: { in: [RUNNER_STATUS.RUNNING, RUNNER_STATUS.IDLE] },
    },
  });

  if (runners.length === 0) {
    logger.info('[Runner] No runners to restore');
    return;
  }

  logger.info(`[Runner] Restoring ${runners.length} runner(s)...`);

  // 先尝试恢复 PM2 中已有的进程
  try {
    execSync('pm2 resurrect', { timeout: 15000 });
    logger.info('[Runner] PM2 process list resurrected');
  } catch {
    // PM2 没有保存的进程列表，忽略
  }

  for (const runner of runners) {
    try {
      logger.info(`[Runner] Restoring runner ${runner.id} (${runner.name})...`);

      // 清除旧的工作目录（容器重启后旧路径已失效）
      await prisma.gitHubRunner.update({
        where: { id: runner.id },
        data: {
          workDir: null,
          runnerToken: null,
          registrationToken: null,
          pid: null,
          status: RUNNER_STATUS.STOPPED,
          lastError: null,
        },
      });

      // 重新注册并启动
      await registerRunner(runner.id);
      await startRunner(runner.id);
      logger.info(`[Runner] Runner ${runner.id} (${runner.name}) restored successfully`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[Runner] Failed to restore runner ${runner.id} (${runner.name}):`, errorMsg);
      // 继续恢复其他 Runner，不中断
    }
  }

  logger.info('[Runner] Runner auto-restore complete');
}
