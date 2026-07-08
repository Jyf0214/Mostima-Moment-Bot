/**
 * 统一日志工具模块
 *
 * 生产环境输出 info、warn 和 error 级别，开发环境输出所有级别。
 * 通过 process.env.NODE_ENV 控制日志级别。
 */

const isDev = process.env.NODE_ENV !== 'production';

function formatMessage(level: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.debug(formatMessage('debug', message), ...args);
    }
  },

  info(message: string, ...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.info(formatMessage('info', message), ...args);
  },

  warn(message: string, ...args: unknown[]): void {
    console.warn(formatMessage('warn', message), ...args);
  },

  error(message: string, ...args: unknown[]): void {
    console.error(formatMessage('error', message), ...args);
  },
};
