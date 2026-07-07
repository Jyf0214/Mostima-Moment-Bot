/**
 * 配置文件合规性测试
 *
 * 验证项目配置文件的完整性和安全性：
 * - .dockerignore 排除完整性
 * - Dockerfile 安全最佳实践
 * - package.json 约束配置
 * - vitest.config.mts 配置完整性
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve(__dirname, '..', '..');

function readFile(filePath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, filePath), 'utf-8');
}

// ============================================================
// 1. .dockerignore 排除完整性
// ============================================================
describe('Docker 构建优化：.dockerignore 排除完整性', () => {
  it('.dockerignore 应排除 .github/ 目录（CI/CD 配置不需要进入镜像）', () => {
    const content = readFile('.dockerignore');
    expect(content).toContain('.github/');
  });

  it('.dockerignore 应排除测试相关文件', () => {
    const content = readFile('.dockerignore');
    expect(content).toContain('__tests__/');
    expect(content).toContain('vitest.config.mts');
  });

  it('.dockerignore 应排除 Lint/格式化配置', () => {
    const content = readFile('.dockerignore');
    expect(content).toContain('eslint.config.mjs');
    expect(content).toContain('.prettierrc');
    expect(content).toContain('.prettierignore');
  });

  it('.dockerignore 应排除 IDE 配置', () => {
    const content = readFile('.dockerignore');
    expect(content).toContain('.vscode/');
    expect(content).toContain('.idea/');
  });

  it('.dockerignore 应排除环境文件（除 .env.example）', () => {
    const content = readFile('.dockerignore');
    expect(content).toContain('.env');
    expect(content).toContain('.env.*');
    expect(content).toContain('!.env.example');
  });

  it('.dockerignore 应排除文档和许可证', () => {
    const content = readFile('.dockerignore');
    expect(content).toContain('*.md');
    expect(content).toContain('LICENSE');
  });

  it('.dockerignore 应排除 coverage 和 .qwen 目录', () => {
    const content = readFile('.dockerignore');
    expect(content).toContain('coverage/');
    expect(content).toContain('.qwen/');
  });
});

// ============================================================
// 2. Dockerfile 安全最佳实践
// ============================================================
describe('Dockerfile 安全最佳实践', () => {
  let dockerfile: string;

  it('Dockerfile 应存在', () => {
    expect(fs.existsSync(path.join(ROOT_DIR, 'docker', 'Dockerfile'))).toBe(true);
    dockerfile = readFile('docker/Dockerfile');
  });

  it('Dockerfile 应使用非 root 用户运行', () => {
    expect(dockerfile).toMatch(/USER\s+\w+/);
    // Dockerfile 最后一行应该是非 root 用户
    const lines = dockerfile.trim().split('\n');
    const lastUserLine = lines.filter((l) => l.match(/^USER\s+/)).pop();
    expect(lastUserLine).not.toMatch(/^USER\s+root\s*$/);
  });

  it('Dockerfile 应配置健康检查', () => {
    expect(dockerfile).toContain('HEALTHCHECK');
  });

  it('Dockerfile 应使用多阶段构建', () => {
    expect(dockerfile).toContain('AS builder');
  });

  it('Dockerfile 应使用 alpine 基础镜像（减小体积）', () => {
    expect(dockerfile).toContain('alpine');
  });

  it('Dockerfile 应安装生产依赖并移除开发依赖', () => {
    expect(dockerfile).toContain('npm prune --omit=dev');
  });

  it('Dockerfile 应复制 prisma.config.ts 到运行阶段', () => {
    expect(dockerfile).toContain('COPY --from=builder /app/prisma.config.ts');
  });

  it('Dockerfile 应生成 Prisma 客户端', () => {
    expect(dockerfile).toContain('prisma generate');
  });

  it('Dockerfile 应设置合理的启动命令', () => {
    expect(dockerfile).toContain('CMD');
  });
});

// ============================================================
// 3. package.json 配置完整性
// ============================================================
describe('package.json 配置完整性', () => {
  it('package.json 应定义 engines 字段约束 Node.js 版本', () => {
    const pkg = JSON.parse(readFile('package.json'));
    expect(pkg.engines).toBeDefined();
    expect(pkg.engines.node).toBeDefined();
  });

  it('engines.node 应要求 Node.js >=20', () => {
    const pkg = JSON.parse(readFile('package.json'));
    expect(pkg.engines.node).toContain('20');
  });

  it('package.json 应包含必要的测试脚本', () => {
    const pkg = JSON.parse(readFile('package.json'));
    expect(pkg.scripts.test).toBeDefined();
    expect(pkg.scripts['test:watch']).toBeDefined();
    expect(pkg.scripts['test:coverage']).toBeDefined();
  });

  it('package.json 应包含 typecheck 脚本', () => {
    const pkg = JSON.parse(readFile('package.json'));
    expect(pkg.scripts.typecheck).toBeDefined();
  });

  it('package.json 应包含 lint 和 lint:fix 脚本', () => {
    const pkg = JSON.parse(readFile('package.json'));
    expect(pkg.scripts.lint).toBeDefined();
    expect(pkg.scripts['lint:fix']).toBeDefined();
  });

  it('package.json 应包含 prisma 相关脚本', () => {
    const pkg = JSON.parse(readFile('package.json'));
    expect(pkg.scripts['prisma:generate']).toBeDefined();
    expect(pkg.scripts['prisma:studio']).toBeDefined();
  });

  it('package.json 应标记为 private（防止误发布）', () => {
    const pkg = JSON.parse(readFile('package.json'));
    expect(pkg.private).toBe(true);
  });
});

// ============================================================
// 4. vitest.config.mts 配置完整性
// ============================================================
describe('vitest.config.mts 配置完整性', () => {
  it('vitest 配置应包含测试超时设置', () => {
    const content = readFile('vitest.config.mts');
    expect(content).toContain('testTimeout');
  });

  it('vitest 配置应包含钩子超时设置', () => {
    const content = readFile('vitest.config.mts');
    expect(content).toContain('hookTimeout');
  });

  it('vitest 配置应包含覆盖率配置', () => {
    const content = readFile('vitest.config.mts');
    expect(content).toContain('coverage');
  });

  it('vitest 配置应使用 @ 路径别名', () => {
    const content = readFile('vitest.config.mts');
    expect(content).toContain("'@'");
  });

  it('vitest 配置应包含 setup 文件', () => {
    const content = readFile('vitest.config.mts');
    expect(content).toContain('setupFiles');
  });
});

// ============================================================
// 5. Docker Compose 配置检查
// ============================================================
describe('docker-compose.yml 配置检查', () => {
  it('docker-compose.yml 应存在', () => {
    expect(fs.existsSync(path.join(ROOT_DIR, 'docker', 'docker-compose.yml'))).toBe(true);
  });

  it('docker-compose.yml 应使用环境变量引用（非硬编码）', () => {
    const content = readFile('docker/docker-compose.yml');
    // 应使用 ${VAR} 引用环境变量
    expect(content).toContain('${PORT:-3001}');
    expect(content).toContain('${DATABASE_URL}');
    expect(content).toContain('${JWT_SECRET}');
  });

  it('docker-compose.yml 应配置重启策略', () => {
    const content = readFile('docker/docker-compose.yml');
    expect(content).toContain('restart:');
  });

  it('docker-compose.yml 应使用只读挂载私钥文件', () => {
    const content = readFile('docker/docker-compose.yml');
    expect(content).toContain(':ro');
  });
});
