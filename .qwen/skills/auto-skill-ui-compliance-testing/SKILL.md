---
name: ui-compliance-testing
description: UI 组件系统合规性审计与测试：检测 antd 绕过、硬编码颜色、死代码、调色板一致性，并验证组件覆盖度
source: auto-skill
extracted_at: '2026-06-20T09:20:38.507Z'
---

# UI 组件系统合规性审计与测试

## 概述

对项目 UI 组件系统进行全面审计，检测绕过自定义组件包的问题（直接使用 antd、硬编码颜色、内联样式等），并创建自动化测试持续守护合规性。

## 审计维度

| 维度          | 检测内容                                 | 严重度 |
| ------------- | ---------------------------------------- | ------ |
| antd 绕过     | 页面/组件直接导入 antd                   | 🔴 高  |
| 硬编码颜色    | `bg-[#xxx]`、`text-[#xxx]` 等 hex 值     | 🔴 高  |
| 死代码        | lib/ui.ts 中未使用的变体定义             | 🔴 高  |
| cn() 缺失     | className 处理未使用 cn() 或模板拼接     | 🟡 中  |
| 内联样式      | `style={{ width: '100%' }}` 等布局硬编码 | 🟡 中  |
| 调色板混用    | 页面混用 gray/zinc 等不同色板            | 🟡 中  |
| barrel export | index.ts 导出但从未被导入                | 🟢 低  |

## 审计流程

### 1. 扫描 antd 直接导入

```bash
# 检查页面文件
grep -rn "from 'antd'" src/pages/ --include='*.tsx'

# 检查组件文件
grep -rn "from 'antd'" src/components/ --include='*.tsx'

# 检查 antd icons
grep -rn "from '@ant-design" src/ --include='*.tsx'
```

**规则：**

- 页面文件不得导入 antd（应使用自定义组件）
- 组件文件不得导入 antd（应使用原生 HTML + Tailwind 或自定义组件）
- 唯一例外：已明确标记为"已修复"的文件

### 2. 扫描硬编码 hex 颜色

```bash
# 检查 Tailwind 任意值中的 hex
grep -rn "\[#[0-9a-fA-F]\{3,8\}\]" src/ --include='*.tsx' --include='*.ts'
```

**规则：**

- `components/ui/` 下不得出现任何 `#xxx` hex 值
- `pages/` 下不得出现 `#xxx` hex 值（CSS 变量定义除外）
- 应使用 Tailwind 标准色板（zinc、red、emerald 等）

### 3. 检测 lib/ui.ts 死代码

```bash
# 检查哪些导出实际被使用
grep -rn "buttonVariants\|cardVariants\|statusColors" src/ --include='*.tsx' --include='*.ts'
```

**规则：**

- `buttonVariants`、`cardVariants`、`statusColors` 等变体定义不应存在于 ui.ts
- 各组件应在自己的 `*-styles.ts` 中定义变体
- ui.ts 应只导出 `cn()` 工具函数

### 4. 检测调色板一致性

```bash
# 检查页面中是否混用 gray 和 zinc
grep -rn "\-gray-" src/pages/ --include='*.tsx'
```

**规则：**

- 项目统一使用 `zinc` 色板
- `env-error.tsx` 等页面不得使用 `gray-*` 类
- 应替换为对应的 `zinc-*` 类

### 5. 检测内联 style 硬编码

```bash
# 检查内联样式中的布局值
grep -rn "style={{ width:" src/components/ --include='*.tsx'
grep -rn "style={{ height:" src/components/ --include='*.tsx'
```

**规则：**

- 组件不得使用 `style={{ width: '100%' }}` 等内联布局
- 应使用 `className="w-full"` 等 Tailwind 类
- 动态值（如渐变、背景图 URL）可以使用内联 style

## 测试文件结构

创建 `src/__tests__/ui-compliance.test.ts`，包含以下测试组：

### 测试组 1：antd 导入检测

- 页面文件不应包含 antd 导入
- components/ui/ 下不应有 antd 导入

### 测试组 2：硬编码颜色检测

- components/ui/ 下不应包含 `#xxx` hex 值
- pages/ 下不应包含 `#xxx` hex 值

### 测试组 3：cn() 使用合规

- className 处理应使用 cn() 或模板拼接
- 排除纯类型文件、barrel export、纯 SVG 组件

### 测试组 4：死代码检测

- ui.ts 中不应存在 buttonVariants/cardVariants/statusColors
- buttonVariants 不应被组件导入

### 测试组 5：内联 style 检测

- 不得包含 `style={{ width:` 等布局硬编码

### 测试组 6：调色板一致性

- 页面不得混用 gray 和 zinc 色板

### 测试组 7：组件文件完整性

- 所有 16 个组件文件应存在
- barrel export 应导出所有组件
- 组件应有正确的 props 接口
- 组件不应包含 console.log
- 组件应导出 TypeScript 类型

### 测试组 8：组件覆盖度

- 应有自定义 Button/Input/Textarea/Select 组件
- 应有 cn() 工具函数

### 测试组 9：组件结构验证

- Button 应支持 10 种变体
- StatusCard 应支持 4 种状态类型
- Tag 应支持 8 种变体
- FormField 不应导入 antd
- ToggleField 应使用 role="switch" 原生实现

## 测试文件模板

```typescript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(__dirname, '..');
const COMPONENTS_DIR = path.join(SRC_DIR, 'components/ui');
const PAGES_DIR = path.join(SRC_DIR, 'pages');
const LIB_DIR = path.join(SRC_DIR, 'lib');

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

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

function fileContains(filePath: string, pattern: RegExp): boolean {
  return pattern.test(readFile(filePath));
}

// 1. 页面文件不得直接导入 antd
describe('UI 合规性：页面文件不得直接导入 antd', () => {
  it('页面文件不应包含 antd 导入', () => {
    const pageFiles = readAllSourceFiles(PAGES_DIR);
    const violations: string[] = [];
    for (const file of pageFiles) {
      if (
        fileContains(file, /from\s+['"]antd['"]/) ||
        fileContains(file, /from\s+['"]@ant-design\//)
      ) {
        violations.push(path.relative(SRC_DIR, file));
      }
    }
    expect(violations).toEqual([]);
  });
});

// 2. 组件不得直接导入 antd
describe('UI 合规性：自定义组件 antd 导入控制', () => {
  it('components/ui/ 下不应有 antd 直接导入', () => {
    const uiFiles = readAllSourceFiles(COMPONENTS_DIR);
    const violations: string[] = [];
    for (const file of uiFiles) {
      if (
        fileContains(file, /from\s+['"]antd['"]/) ||
        fileContains(file, /from\s+['"]@ant-design\//)
      ) {
        violations.push(path.relative(COMPONENTS_DIR, file));
      }
    }
    expect(violations).toEqual([]);
  });
});

// 3. 硬编码 hex 颜色检测
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
});

// 4. cn() 使用检测
describe('UI 合规性：组件必须使用 cn() 工具函数', () => {
  it('有 className 处理逻辑的组件应使用 cn() 或模板拼接', () => {
    const uiFiles = readAllSourceFiles(COMPONENTS_DIR);
    const excluded = ['index.ts', 'button-types.ts', 'LoadingSpinner.tsx'];
    const violations: string[] = [];
    for (const file of uiFiles) {
      const basename = path.basename(file);
      if (excluded.includes(basename)) continue;
      const content = readFile(file);
      if (!content.includes('className')) continue;
      const usesCn = content.includes("from '@/lib/ui'") || content.includes('cn(');
      const usesTemplateLiteral = /className=\{`[^`]*\$\{/.test(content);
      const usesArrayJoin = /\.filter\(Boolean\)\.join\(/.test(content);
      if (!usesCn && !usesTemplateLiteral && !usesArrayJoin) {
        violations.push(path.relative(COMPONENTS_DIR, file));
      }
    }
    expect(violations).toEqual([]);
  });
});

// 5. 死代码检测
describe('UI 合规性：lib/ui.ts 不应包含未使用的变体定义', () => {
  it('lib/ui.ts 中不应存在 buttonVariants/cardVariants/statusColors', () => {
    const uiTs = readFile(path.join(LIB_DIR, 'ui.ts'));
    expect(uiTs).not.toContain('buttonVariants');
    expect(uiTs).not.toContain('cardVariants');
    expect(uiTs).not.toContain('statusColors');
  });
});

// 6. 内联 style 检测
describe('UI 合规性：不应使用内联 style 硬编码布局值', () => {
  it('components/ui/ 下不应包含 style={{ width: }} 内联样式', () => {
    const uiFiles = readAllSourceFiles(COMPONENTS_DIR);
    const violations: string[] = [];
    for (const file of uiFiles) {
      const content = readFile(file);
      if (/style=\{\{\s*(width|height)\s*[:=]/.test(content)) {
        violations.push(path.relative(COMPONENTS_DIR, file));
      }
    }
    expect(violations).toEqual([]);
  });
});

// 7. 调色板一致性
describe('UI 合规性：调色板一致性', () => {
  it('pages/ 下不应混用 gray 和 zinc 调色板', () => {
    const pageFiles = readAllSourceFiles(PAGES_DIR);
    const violations: string[] = [];
    for (const file of pageFiles) {
      if (/(?:bg|text|border)-gray-\d/.test(readFile(file))) {
        violations.push(path.relative(PAGES_DIR, file));
      }
    }
    expect(violations).toEqual([]);
  });
});
```

## 修复模式

### 模式 1：移除 antd 依赖

**FormField.tsx（Select 类型）：**

```tsx
// ❌ 旧代码
import { Select, Input as AntInput } from 'antd';
<Select value={value} onChange={onChange} options={options} style={{ width: '100%' }} />;

// ✅ 新代码
import { Select } from '@/components/ui/Select';
<Select value={value} onChange={(e) => onChange(e.target.value)} className="w-full">
  {options.map((opt) => (
    <option key={opt.value} value={opt.value}>
      {opt.label}
    </option>
  ))}
</Select>;
```

**FormField.tsx（Textarea 类型）：**

```tsx
// ❌ 旧代码
import { Input as AntInput } from 'antd';
<AntInput.TextArea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />;

// ✅ 新代码
import { Textarea } from '@/components/ui/Textarea';
<Textarea value={value} onChange={(e) => onChange(e.target.value)} />;
```

**ToggleField.tsx：**

```tsx
// ❌ 旧代码
import { Switch } from 'antd';
<Switch id={switchId} checked={checked} onChange={onChange} />

// ✅ 新代码：原生 toggle 实现
<button
  id={switchId}
  type="button"
  role="switch"
  aria-checked={checked}
  onClick={() => onChange(!checked)}
  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
    checked ? 'bg-zinc-900' : 'bg-zinc-200'
  }`}
>
  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ${
    checked ? 'translate-x-5' : 'translate-x-0'
  }`} />
</button>
```

### 模式 2：清理死代码

```typescript
// ❌ 旧代码 - lib/ui.ts
export const buttonVariants = {
  primary: 'bg-[#1677ff] text-white hover:bg-[#4096ff]',
  // ...
};

// ✅ 新代码 - lib/ui.ts 只保留 cn()
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 模式 3：统一调色板

```tsx
// ❌ 旧代码
<div className="bg-gray-900 text-gray-100 border-gray-200">

// ✅ 新代码
<div className="bg-zinc-900 text-zinc-100 border-zinc-200">
```

### 模式 4：移除硬编码 hex

```tsx
// ❌ 旧代码
<div className="bg-gradient-to-br from-[#ff4b2b] via-[#ff416c] to-[#2d1b69]">

// ✅ 新代码：使用 Tailwind 标准色板
<div className="bg-gradient-to-br from-red-500 via-rose-500 to-purple-900">
```

### 模式 5：替换内联 style

```tsx
// ❌ 旧代码
<Select style={{ width: '100%' }} />

// ✅ 新代码
<Select className="w-full" />
```

## 验证

```bash
# 运行 UI 合规性测试
npx vitest run src/__tests__/ui-compliance.test.ts

# 运行完整测试套件（包含 UI 合规性检查）
npx vitest run

# 快速检查 antd 残留
grep -rn "from 'antd'" src/ --include='*.tsx' --include='*.ts'

# 快速检查硬编码颜色
grep -rn "\[#[0-9a-fA-F]" src/ --include='*.tsx'
```

## 常见问题

### 1. 测试路径重复 `src/src/`

**原因：** `__dirname` 在 `src/__tests__/` 下，`path.resolve(__dirname, '../src')` 会变成 `src/src/`。

**修复：** 使用 `path.resolve(__dirname, '..')` 直接指向 `src/`。

### 2. cn() 检测误报

**原因：** 组件使用模板字符串或 Array.filter().join() 而非 cn()。

**修复：** 测试应接受这些合法模式：模板拼接、数组 join、三元赋值、className 透传。

### 3. Button 尺寸测试失败

**原因：** 测试检查 `'sm'`（带引号），但 button-styles.ts 使用 `sm:`（Tailwind 前缀）。

**修复：** 测试应检查 `sm:` 而非 `'sm'`。

### 4. ToggleField 测试失败

**原因：** 测试检查 `Switch` 字符串，但修复后使用原生 `<button role="switch">`。

**修复：** 测试应检查 `role="switch"` 和 `aria-checked`。
