/**
 * 鉴权与 RBAC 中间件。
 *
 *   authRequired  —— 校验 JWT,挂载 req.actor
 *   requireRole(...roles) —— 角色守卫
 *
 * V1 兼容:若请求带 x-actor-id/x-actor-role 头(开发态),直接信任,
 *         方便在未配 JWT 时先跑通流程。生产环境务必启用 JWT。
 */
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Role } from '@rescueflow/shared';

export function authRequired(req, _res, next) {
  // 开发态兼容:信任头(生产环境强制走 JWT,防止伪造身份)
  if (!env.isProd) {
    const headerId = req.headers['x-actor-id'];
    const headerRole = req.headers['x-actor-role'];
    if (headerId && headerRole) {
      req.actor = { id: headerId, role: headerRole };
      return next();
    }
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) {
    return next(Object.assign(new Error('未登录'), { status: 401 }));
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.actor = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(Object.assign(new Error('登录已过期'), { status: 401 }));
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    const role = req.actor?.role || Role.PUBLIC;
    if (!roles.includes(role)) {
      return next(Object.assign(new Error('权限不足'), { status: 403 }));
    }
    next();
  };
}
