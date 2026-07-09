/**
 * 统一响应封装。
 */
export function ok(data = null, message = 'ok') {
  return { code: 0, message, data };
}

export function fail(message = 'error', code = 1, extra = null) {
  return { code, message, data: extra };
}
