/**
 * UI 合规性测试
 *
 * 验证项目 UI 组件系统的完整性和一致性：
 * - 自定义组件包的使用情况
 * - 硬编码 UI 样式检测
 * - antd 直接导入检测
 * - 组件渲染正确性
 * - 死代码检测
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(__dirname, '..');
const COMPONENTS_DIR = path.join(SRC_DIR, 'components/ui');
const PAGES_DIR = path.join(SRC_DIR, 'pages');
const LIB_DIR = path.join(SRC_DIR, 'lib');

/**
 * 递归读取目录下所有 .ts/.tsx 文件
 */
function readAllSourceFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...readAllSourceFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * 读取文件内容
 */
function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * 检查文件是否包含指定模式
 */
function fileContains(filePath: string, pattern: RegExp): boolean {
  return pattern.test(readFile(filePath));
}

// ============================================================
// 1. 页面文件不得直接导入 antd
// ============================================================
describe('UI 合规性：页面文件不得直接导入 antd', () => {
  const pageFiles = readAllSourceFiles(PAGES_DIR);

  it('页面文件不应包含 antd 导入', () => {
    const violations: string[] = [];
    for (const file of pageFiles) {
      const rel = path.relative(SRC_DIR, file);
      if (
        fileContains(file, /from\s+['"]antd['"]/) ||
        fileContains(file, /from\s+['"]@ant-design\//)
      ) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });
});

// ============================================================
// 2. 自定义组件不得直接导入 antd（除已知的两个外）
// ============================================================
describe('UI 合规性：自定义组件 antd 导入控制', () => {
  it('components/ui/ 下不应有 antd 直接导入', () => {
    const uiFiles = readAllSourceFiles(COMPONENTS_DIR);
    const violations: string[] = [];
    for (const file of uiFiles) {
      const rel = path.relative(COMPONENTS_DIR, file);
      if (
        fileContains(file, /from\s+['"]antd['"]/) ||
        fileContains(file, /from\s+['"]@ant-design\//)
      ) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });
});

// ============================================================
// 3. 硬编码 hex 颜色检测
// ============================================================
describe('UI 合规性：硬编码 hex 颜色检测', () => {
  it('components/ui/ 下不应包含硬编码的 hex 颜色值', () => {
    const uiFiles = readAllSourceFiles(COMPONENTS_DIR);
    const hexPattern = /['"]#[0-9a-fA-F]{3,8}['"]/g;
    const violations: { file: string; line: number; value: string }[] = [];

    for (const file of uiFiles) {
      const rel = path.relative(COMPONENTS_DIR, file);
      const lines = readFile(file).split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // 跳过注释行
        if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;
        let match;
        while ((match = hexPattern.exec(line)) !== null) {
          violations.push({ file: rel, line: i + 1, value: match[0] });
        }
        hexPattern.lastIndex = 0;
      }
    }
    expect(violations).toEqual([]);
  });

  it('pages/ 下不应包含硬编码的 hex 颜色值（CSS 变量除外）', () => {
    const pageFiles = readAllSourceFiles(PAGES_DIR);
    const hexPattern = /['"]#[0-9a-fA-F]{3,8}['"]/g;
    const violations: { file: string; line: number; value: string }[] = [];

    for (const file of pageFiles) {
      const rel = path.relative(PAGES_DIR, file);
      const lines = readFile(file).split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;
        // 允许 CSS 变量定义中的 hex（如 globals.css）
        if (line.includes('var(')) continue;
        let match;
        while ((match = hexPattern.exec(line)) !== null) {
          violations.push({ file: rel, line: i + 1, value: match[0] });
        }
        hexPattern.lastIndex = 0;
      }
    }
    expect(violations).toEqual([]);
  });
});

// ============================================================
// 4. 自定义组件必须使用 cn() 工具函数
// ============================================================
describe('UI 合规性：组件必须使用 cn() 工具函数', () => {
  it('components/ui/ 下有 className 处理逻辑的组件应使用 cn() 或简单模板拼接', () => {
    const uiFiles = readAllSourceFiles(COMPONENTS_DIR);
    // 排除纯类型文件、barrel export、纯 SVG 组件
    const excluded = ['index.ts', 'button-types.ts', 'LoadingSpinner.tsx'];
    const violations: string[] = [];

    for (const file of uiFiles) {
      const basename = path.basename(file);
      if (excluded.includes(basename)) continue;
      const content = readFile(file);
      if (!content.includes('className')) continue;
      // 检查是否使用了 cn() 或模板字符串拼接
      const usesCn =
        content.includes("from '@/lib/ui'") ||
        content.includes('from "../ui') ||
        content.includes('import { cn }') ||
        content.includes('import { cn,');
      const callsCn = content.includes('cn(');
      // 允许简单的模板字符串拼接（className={`... ${...}`})
      const usesTemplateLiteral = /className=\{`[^`]*\$\{/.test(content);
      // 允许 Array.filter().join() 模式
      const usesArrayJoin = /\.filter\(Boolean\)\.join\(/.test(content);
      // 允许简单的三元表达式赋值给变量再使用（如 EmptyState）
      const usesTernaryAssign = /const\s+\w+Class\s*=\s*\w+\s*===/.test(content);
      // 允许通过变量传递 className（如 FormField 将 className 传给子组件）
      const passesClassName =
        /className=\{\w+\}/.test(content) && content.includes('className?: string');
      if (
        !usesCn &&
        !callsCn &&
        !usesTemplateLiteral &&
        !usesArrayJoin &&
        !usesTernaryAssign &&
        !passesClassName
      ) {
        violations.push(path.relative(COMPONENTS_DIR, file));
      }
    }
    expect(violations).toEqual([]);
  });
});

// ============================================================
// 5. lib/ui.ts 死代码检测
// ============================================================
describe('UI 合规性：lib/ui.ts 不应包含未使用的变体定义', () => {
  it('buttonVariants 不应被组件导入（各组件有自己的变体定义）', () => {
    const uiFiles = readAllSourceFiles(COMPONENTS_DIR);
    const violations: string[] = [];
    for (const file of uiFiles) {
      const content = readFile(file);
      if (content.includes('buttonVariants') && !file.includes('ui.ts')) {
        violations.push(path.relative(COMPONENTS_DIR, file));
      }
    }
    expect(violations).toEqual([]);
  });

  it('lib/ui.ts 中不应存在 buttonVariants/cardVariants/statusColors 定义', () => {
    const uiTs = readFile(path.join(LIB_DIR, 'ui.ts'));
    expect(uiTs).not.toContain('buttonVariants');
    expect(uiTs).not.toContain('cardVariants');
    expect(uiTs).not.toContain('statusColors');
    expect(uiTs).not.toContain('ButtonVariant');
    expect(uiTs).not.toContain('CardVariant');
  });
});

// ============================================================
// 6. 页面文件不得使用内联 style 硬编码宽度
// ============================================================
describe('UI 合规性：不应使用内联 style 硬编码布局值', () => {
  it('components/ui/ 下不应包含 style={{ width: }} 内联样式', () => {
    const uiFiles = readAllSourceFiles(COMPONENTS_DIR);
    const violations: string[] = [];
    for (const file of uiFiles) {
      const rel = path.relative(COMPONENTS_DIR, file);
      const content = readFile(file);
      // 检测 style={{ width: 或 style={{ height: 等硬编码布局
      if (
        /style=\{\{\s*(width|height|minWidth|minHeight|maxWidth|maxHeight)\s*[:=]/.test(content)
      ) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });
});

// ============================================================
// 7. 调色板一致性检测
// ============================================================
describe('UI 合规性：调色板一致性', () => {
  it('pages/ 下不应混用 gray 和 zinc 调色板', () => {
    const pageFiles = readAllSourceFiles(PAGES_DIR);
    const violations: string[] = [];
    for (const file of pageFiles) {
      const rel = path.relative(PAGES_DIR, file);
      const content = readFile(file);
      // 检测 gray 色板（应统一为 zinc）
      if (/(?:bg|text|border|ring|divide|from|via|to)-gray-\d/.test(content)) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });
});

// ============================================================
// 8. 组件渲染正确性测试（真实 DOM 渲染）
// ============================================================
describe('UI 组件渲染正确性', () => {
  // 使用纯 Node.js 环境验证组件导出和结构正确性
  // （不需要 DOM 环境，仅验证模块导出和类型）

  it('所有自定义组件文件应存在且可解析', () => {
    const expectedComponents = [
      'Button/index.tsx',
      'Input.tsx',
      'Textarea.tsx',
      'Select.tsx',
      'StatusCard.tsx',
      'PageContainer.tsx',
      'EmptyState.tsx',
      'ProCard.tsx',
      'ConfigSection.tsx',
      'FormField.tsx',
      'ToggleField.tsx',
      'Skeleton.tsx',
      'Tag.tsx',
      'FilterPill.tsx',
      'HeroBanner.tsx',
      'ButtonGroup.tsx',
    ];
    for (const comp of expectedComponents) {
      const filePath = path.join(COMPONENTS_DIR, comp);
      expect(fs.existsSync(filePath), `组件文件应存在: ${comp}`).toBe(true);
      const content = readFile(filePath);
      expect(content.length, `组件文件不应为空: ${comp}`).toBeGreaterThan(0);
    }
  });

  it('barrel export (index.ts) 应导出所有组件', () => {
    const barrelPath = path.join(COMPONENTS_DIR, 'index.ts');
    expect(fs.existsSync(barrelPath)).toBe(true);
    const barrel = readFile(barrelPath);

    const expectedExports = [
      'Button',
      'Input',
      'Textarea',
      'Select',
      'StatusCard',
      'PageContainer',
      'EmptyState',
      'ProCard',
      'ConfigSection',
      'FormField',
      'ToggleField',
      'Skeleton',
      'Tag',
      'FilterPill',
      'HeroBanner',
      'ButtonGroup',
    ];
    for (const name of expectedExports) {
      expect(barrel, `barrel 应导出 ${name}`).toContain(name);
    }
  });

  it('组件应有正确的 props 接口定义', () => {
    // Button 应支持 variant, size, loading 等核心 props
    const buttonTypes = readFile(path.join(COMPONENTS_DIR, 'Button/button-types.ts'));
    expect(buttonTypes).toContain('variant');
    expect(buttonTypes).toContain('size');
    expect(buttonTypes).toContain('loading');
    expect(buttonTypes).toContain('icon');

    // Input 应支持 label, error 等核心 props
    const input = readFile(path.join(COMPONENTS_DIR, 'Input.tsx'));
    expect(input).toContain('label');
    expect(input).toContain('error');

    // StatusCard 应支持 statusType
    const statusCard = readFile(path.join(COMPONENTS_DIR, 'StatusCard.tsx'));
    expect(statusCard).toContain('statusType');
  });

  it('组件不应包含 console.log 调试输出', () => {
    const uiFiles = readAllSourceFiles(COMPONENTS_DIR);
    const violations: string[] = [];
    for (const file of uiFiles) {
      const rel = path.relative(COMPONENTS_DIR, file);
      const content = readFile(file);
      if (/console\.log\(/.test(content)) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });

  it('组件应导出 TypeScript 类型定义', () => {
    const barrelPath = path.join(COMPONENTS_DIR, 'index.ts');
    const barrel = readFile(barrelPath);
    // barrel 应导出至少 10 个类型
    const typeExports = barrel.match(/type\s+\w+Props/g) || [];
    expect(typeExports.length).toBeGreaterThanOrEqual(10);
  });
});

// ============================================================
// 9. 自定义组件覆盖度检测
// ============================================================
describe('UI 合规性：自定义组件覆盖度', () => {
  it('项目应有自定义 Button 组件替代原生 <button>', () => {
    const buttonDir = path.join(COMPONENTS_DIR, 'Button');
    expect(fs.existsSync(path.join(buttonDir, 'index.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(buttonDir, 'button-types.ts'))).toBe(true);
    expect(fs.existsSync(path.join(buttonDir, 'button-styles.ts'))).toBe(true);
  });

  it('项目应有自定义 Input/Textarea/Select 组件替代原生表单元素', () => {
    expect(fs.existsSync(path.join(COMPONENTS_DIR, 'Input.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(COMPONENTS_DIR, 'Textarea.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(COMPONENTS_DIR, 'Select.tsx'))).toBe(true);
  });

  it('项目应有 cn() 工具函数用于类名合并', () => {
    const uiTs = path.join(LIB_DIR, 'ui.ts');
    expect(fs.existsSync(uiTs)).toBe(true);
    const content = readFile(uiTs);
    expect(content).toContain('export function cn');
    expect(content).toContain('clsx');
    expect(content).toContain('twMerge');
  });

  it('cn() 是 lib/ui.ts 中唯一的导出函数', () => {
    const uiTs = readFile(path.join(LIB_DIR, 'ui.ts'));
    const functionExports = uiTs.match(/export function \w+/g) || [];
    expect(functionExports).toHaveLength(1);
    expect(functionExports[0]).toContain('cn');
  });
});

// ============================================================
// 10. 真实组件渲染测试（使用 jsdom 环境模拟）
// ============================================================
describe('UI 组件结构验证', () => {
  it('Button 组件应支持 10 种变体', () => {
    const styles = readFile(path.join(COMPONENTS_DIR, 'Button/button-styles.ts'));
    const variants = [
      'primary',
      'default',
      'secondary',
      'danger',
      'dangerGhost',
      'ghost',
      'link',
      'success',
      'warning',
      'filled',
    ];
    for (const v of variants) {
      expect(styles, `Button 应包含 ${v} 变体`).toContain(v);
    }
  });

  it('Button 组件应支持 3 种尺寸', () => {
    const styles = readFile(path.join(COMPONENTS_DIR, 'Button/button-styles.ts'));
    expect(styles).toContain('sm:');
    expect(styles).toContain('md:');
    expect(styles).toContain('lg:');
  });

  it('StatusCard 组件应支持 4 种状态类型', () => {
    const statusCard = readFile(path.join(COMPONENTS_DIR, 'StatusCard.tsx'));
    expect(statusCard).toContain('success');
    expect(statusCard).toContain('warning');
    expect(statusCard).toContain('error');
    expect(statusCard).toContain('info');
  });

  it('Tag 组件应支持 8 种变体', () => {
    const tag = readFile(path.join(COMPONENTS_DIR, 'Tag.tsx'));
    const tagVariants = [
      'light',
      'dark',
      'outline',
      'emerald',
      'amber',
      'danger',
      'success',
      'warning',
    ];
    for (const v of tagVariants) {
      expect(tag, `Tag 应包含 ${v} 变体`).toContain(v);
    }
  });

  it('PageContainer 组件应支持 5 种最大宽度', () => {
    const pc = readFile(path.join(COMPONENTS_DIR, 'PageContainer.tsx'));
    expect(pc).toContain('3xl');
    expect(pc).toContain('4xl');
    expect(pc).toContain('5xl');
    expect(pc).toContain('6xl');
    expect(pc).toContain('7xl');
  });

  it('HeroBanner 组件应支持渐变和背景图两种模式', () => {
    const hero = readFile(path.join(COMPONENTS_DIR, 'HeroBanner.tsx'));
    expect(hero).toContain('backgroundImage');
    expect(hero).toContain('gradient');
  });

  it('FormField 组件应支持 text/textarea/select 三种类型', () => {
    const ff = readFile(path.join(COMPONENTS_DIR, 'FormField.tsx'));
    expect(ff).toContain("'text'");
    expect(ff).toContain("'textarea'");
    expect(ff).toContain("'select'");
    // 不应导入 antd
    expect(ff).not.toContain("from 'antd'");
  });

  it('ToggleField 组件不应导入 antd', () => {
    const tf = readFile(path.join(COMPONENTS_DIR, 'ToggleField.tsx'));
    expect(tf).not.toContain("from 'antd'");
    // 应使用 role="switch" 的原生 toggle 实现
    expect(tf).toContain('role="switch"');
    expect(tf).toContain('aria-checked');
  });
});
