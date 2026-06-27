/**
 * API 请求工具函数
 *
 * 提供类型安全的请求参数提取，替代直接对 req.query 的类型断言。
 */

import type { NextApiRequest } from 'next';

/**
 * 从 NextApiRequest.query 中安全提取单个查询参数
 *
 * Next.js 的 req.query 类型为 ParsedUrlQuery，即 `string | string[] | ParsedUrlQuery`。
 * 此函数统一处理该类型，始终返回第一个字符串值（如有）。
 *
 * @param req - Next.js API 请求对象
 * @param key - 查询参数名
 * @returns 参数值字符串，不存在时返回 undefined
 */
export function getQueryParam(req: NextApiRequest, key: string): string | undefined {
  const value = req.query[key];
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : undefined;
  return String(value);
}

/**
 * 从 req.query 中提取数值参数，带默认值和上下界限制
 *
 * @param req - Next.js API 请求对象
 * @param key - 查询参数名
 * @param fallback - 参数缺失或无效时的默认值
 * @param min - 最小值（可选）
 * @param max - 最大值（可选）
 * @returns 有效的数值
 */
export function getQueryParamNumber(
  req: NextApiRequest,
  key: string,
  fallback: number,
  min?: number,
  max?: number
): number {
  const raw = getQueryParam(req, key);
  if (raw === undefined) return fallback;
  const num = Number(raw);
  if (Number.isNaN(num)) return fallback;
  let result = num;
  if (min !== undefined && result < min) result = min;
  if (max !== undefined && result > max) result = max;
  return result;
}

/**
 * 从 req.query 中提取布尔参数（仅 'true' 视为 true）
 *
 * @param req - Next.js API 请求对象
 * @param key - 查询参数名
 * @returns 布尔值
 */
export function getQueryParamBoolean(req: NextApiRequest, key: string): boolean {
  return getQueryParam(req, key) === 'true';
}
