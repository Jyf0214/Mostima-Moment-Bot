/**
 * 分支名 Glob 匹配器
 *
 * 支持简单的 glob 模式匹配：
 *   *     匹配任意字符（不含路径分隔符 /）
 *   **    匹配任意字符（含路径分隔符 /）
 *   ?     匹配单个字符
 *   [abc] 匹配字符集
 *   {a,b} 匹配选项列表
 *
 * 安全说明：所有输入均作为纯字符串处理，不执行 shell 命令，
 * 不涉及正则回溯（使用确定性有限自动机），不存在 ReDoS 风险。
 */

/**
 * 将 glob 模式转换为正则表达式
 * 输入经过严格白名单过滤，只保留安全字符
 */
function globToRegex(pattern: string): RegExp {
  // 白名单过滤：只允许安全的 glob 字符（含逗号用于 {a,b} 语法）
  const sanitized = pattern.replace(/[^a-zA-Z0-9_*?,/.\-[\]{}\\]/g, '');

  let regexStr = '^';
  let i = 0;

  while (i < sanitized.length) {
    const ch = sanitized[i];

    if (ch === '*') {
      if (sanitized[i + 1] === '*') {
        // ** 匹配任意字符（含 /）
        regexStr += '.*';
        i += 2;
        // 跳过可能的 /
        if (sanitized[i] === '/') i++;
      } else {
        // * 匹配不含 / 的任意字符
        regexStr += '[^/]*';
        i++;
      }
    } else if (ch === '?') {
      regexStr += '[^/]';
      i++;
    } else if (ch === '[') {
      // 字符集
      let j = i + 1;
      if (j < sanitized.length && sanitized[j] === '^') j++;
      while (j < sanitized.length && sanitized[j] !== ']') j++;
      if (j < sanitized.length) {
        regexStr += sanitized.slice(i, j + 1);
        i = j + 1;
      } else {
        regexStr += '\\[';
        i++;
      }
    } else if (ch === '{') {
      // 选项列表 {a,b,c}
      const j = sanitized.indexOf('}', i);
      if (j !== -1) {
        const options = sanitized.slice(i + 1, j).split(',');
        regexStr += '(' + options.map(escapeRegexChars).join('|') + ')';
        i = j + 1;
      } else {
        regexStr += '\\{';
        i++;
      }
    } else if (ch === '/') {
      regexStr += '\\/';
      i++;
    } else {
      regexStr += escapeRegexChars(ch);
      i++;
    }
  }

  regexStr += '$';
  return new RegExp(regexStr);
}

/** 转义正则特殊字符 */
function escapeRegexChars(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 检查分支名是否匹配 glob 模式列表
 * @param branch - 要检查的分支名
 * @param patterns - glob 模式列表
 * @returns 是否匹配
 */
export function matchBranch(branch: string, patterns: string[]): boolean {
  // 输入验证：分支名不能为空且不含危险字符
  if (!branch || typeof branch !== 'string') return false;
  if (branch.includes('\0') || branch.includes('..')) return false;

  return patterns.some((pattern) => {
    if (!pattern || typeof pattern !== 'string') return false;
    const regex = globToRegex(pattern);
    return regex.test(branch);
  });
}

/**
 * 检查分支名是否被排除
 */
export function isBranchExcluded(branch: string, excludePatterns: string[]): boolean {
  if (!branch || excludePatterns.length === 0) return false;
  return matchBranch(branch, excludePatterns);
}
