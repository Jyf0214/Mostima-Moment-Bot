import fs from 'fs';
import path from 'path';

/**
 * i18n 合规性检查测试
 *
 * 检查所有代码文件中（除注释外）是否存在中文字符。
 * 如果存在，说明未使用 i18n，测试将失败。
 *
 * 允许包含中文的文件：
 * - i18n 翻译文件（locales/*.json）
 * - 测试文件（__tests__/*.test.ts）
 * - QWEN.md 等文档文件
 */

// 中文字符 Unicode 范围
const CHINESE_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/;

// 需要扫描的目录
const SRC_DIR = path.resolve(__dirname, '..');

// 排除的目录
const EXCLUDED_DIRS = [
  'node_modules',
  '.next',
  'dist',
  'coverage',
  '__tests__',
  'i18n/locales',
  'lib/qwen',
  'qwen',
];

// 排除的文件
const EXCLUDED_FILES = ['jest.config.ts', 'jest.setup.ts', 'prisma.config.ts'];

// 文件扩展名
const EXTENSIONS = ['.ts', '.tsx'];

/**
 * 移除单行注释（// ...）
 */
function removeSingleLineComments(code: string): string {
  // 匹配 // 但排除 URL 中的 //
  return code.replace(/(?<![:\w])\/\/(?!\/).*$/gm, '');
}

/**
 * 移除多行注释（/* ... * /）
 */
function removeMultiLineComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * 移除 JSX 注释
 */
function removeJSXComments(code: string): string {
  return code.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

/**
 * 移除所有注释
 */
function removeAllComments(code: string): string {
  let result = code;
  result = removeJSXComments(result);
  result = removeMultiLineComments(result);
  result = removeSingleLineComments(result);
  return result;
}

/**
 * 检查文件是否应被跳过
 */
function shouldSkipFile(filePath: string): boolean {
  const relativePath = path.relative(SRC_DIR, filePath);

  // 排除的目录
  if (EXCLUDED_DIRS.some((dir) => relativePath.startsWith(dir))) {
    return true;
  }

  // 排除的文件
  if (EXCLUDED_FILES.some((file) => relativePath.endsWith(file))) {
    return true;
  }

  // 排除的扩展名
  if (!EXTENSIONS.some((ext) => filePath.endsWith(ext))) {
    return true;
  }

  return false;
}

/**
 * 递归获取所有文件
 */
function getAllFiles(dir: string): string[] {
  const files: string[] = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.includes(entry.name)) {
        files.push(...getAllFiles(fullPath));
      }
    } else if (entry.isFile()) {
      if (EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * 找到中文字符所在的行号
 */
function findChineseLines(code: string): { line: number; content: string }[] {
  const lines = code.split('\n');
  const results: { line: number; content: string }[] = [];

  lines.forEach((line, index) => {
    if (CHINESE_REGEX.test(line)) {
      results.push({
        line: index + 1,
        content: line.trim(),
      });
    }
  });

  return results;
}

describe('i18n 合规性检查', () => {
  it('代码文件中不应存在未国际化的中文字符', () => {
    const files = getAllFiles(SRC_DIR);
    const violations: {
      file: string;
      line: number;
      content: string;
    }[] = [];

    for (const file of files) {
      if (shouldSkipFile(file)) {
        continue;
      }

      const code = fs.readFileSync(file, 'utf-8');
      const codeWithoutComments = removeAllComments(code);
      const chineseLines = findChineseLines(codeWithoutComments);

      for (const { line, content } of chineseLines) {
        const relativePath = path.relative(SRC_DIR, file);
        violations.push({
          file: relativePath,
          line,
          content,
        });
      }
    }

    if (violations.length > 0) {
      const errorMessage = violations
        .map((v) => `  ❌ ${v.file}:${v.line}\n     ${v.content}`)
        .join('\n\n');

      console.error(
        '\n🚫 i18n 合规性检查失败！\n\n' +
          '以下代码文件中存在未国际化的中文字符：\n\n' +
          errorMessage +
          '\n\n' +
          '💡 解决方法：使用 useTranslation() 或 t() 函数进行国际化\n' +
          '   示例：const { t } = useTranslation();\n' +
          '         <Text>{t("key")}</Text>\n'
      );

      throw new Error(`发现 ${violations.length} 处未国际化的中文字符，请使用 i18n`);
    }
  });

  it('i18n 翻译文件应存在', () => {
    const localesDir = path.join(SRC_DIR, 'i18n', 'locales');

    expect(fs.existsSync(localesDir)).toBe(true);

    const files = fs.readdirSync(localesDir);
    expect(files.length).toBeGreaterThan(0);

    // 检查是否有英文翻译
    expect(files.some((f) => f.endsWith('en.json'))).toBe(true);

    // 检查是否有中文翻译
    expect(files.some((f) => f.endsWith('zh.json'))).toBe(true);
  });

  it('i18n 翻译文件应包含所有必需的键', () => {
    const enPath = path.join(SRC_DIR, 'i18n', 'locales', 'en.json');
    const zhPath = path.join(SRC_DIR, 'i18n', 'locales', 'zh.json');

    if (!fs.existsSync(enPath) || !fs.existsSync(zhPath)) {
      return;
    }

    const en = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
    const zh = JSON.parse(fs.readFileSync(zhPath, 'utf-8'));

    // 检查键是否一致
    const enKeys = Object.keys(en);
    const zhKeys = Object.keys(zh);

    expect(enKeys.sort()).toEqual(zhKeys.sort());
  });
});
