/**
 * 限流中间件 —— 灾时防高并发打挂系统。
 *
 * 策略(灾时友好):
 *   - 群众端登记/上传:放宽(灾区突发高峰正常),100 次/分钟/IP
 *   - 管理 API:适中,60 次/分钟/IP
 *   - 敏感操作(登录/明文查看):严格,20 次/分钟/IP,防爆破
 *
 * 超限返回 429 + Retry-After,前端友好处理。
 *
 * 注:单机内存计数器,适合中小规模;多实例部署需换 Redis store。
 */
import rateLimit from 'express-rate-limit';

const minute = 60 * 1000;

function handler(req, res) {
  res.status(429).json({
    code: 429,
    message: '请求过于频繁,请稍后再试',
    data: { retryAfter: 60 },
  });
}

// 群众端:登记/上传放宽
export const publicLimiter = rateLimit({
  windowMs: minute,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

// 管理 API
export const adminLimiter = rateLimit({
  windowMs: minute,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

// 敏感操作:登录/明文(防爆破)
export const strictLimiter = rateLimit({
  windowMs: minute,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

// 全局兜底:单 IP 每分钟最多 300 次请求(防最粗暴的攻击)
export const globalLimiter = rateLimit({
  windowMs: minute,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});
