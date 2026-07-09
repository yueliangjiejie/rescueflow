/**
 * 鉴权路由。
 *   POST /api/auth/login   登录,返回 JWT
 *   GET  /api/auth/me      当前登录者
 */
import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { authRequired } from '../middlewares/auth.js';
import { strictLimiter } from '../middlewares/rateLimit.js';
import { ok } from '../utils/response.js';
import { login } from '../services/authService.js';

export const router = Router();

router.post('/auth/login', strictLimiter, asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json(ok(null, '需提供用户名和密码'));
    const result = await login(username, password);
    res.json(ok(result));
  })
);

router.get('/auth/me', authRequired, (req, res) => {
  res.json(ok(req.actor));
});
