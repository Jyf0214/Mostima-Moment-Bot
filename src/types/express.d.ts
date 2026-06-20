import { Request } from 'express';

// 扩展 Express Request 类型以包含 rawBody
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

export {};
