/**
 * 全局错误处理中间件。
 * 把抛出的 Error 统一转成 JSON,避免 500 直接吐栈。
 */
import { fail } from '../utils/response.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) {
    console.error('[error]', err);
  }
  res.status(status).json(fail(err.message || '服务器内部错误', err.code || status));
}

/**
 * 把同步/异步抛错转给 errorHandler。
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
