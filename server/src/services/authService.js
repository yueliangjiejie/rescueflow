/**
 * 登录服务 —— 签发 JWT。
 * V1: 用户名/密码(明文比对,灾时快速用);生产应换 bcrypt + 强密码。
 */
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Role } from '@rescueflow/shared';

export async function login(username, password) {
  const user = await User.findOne({ username, active: true }).exec();
  if (!user) {
    const e = new Error('用户不存在或已停用');
    e.status = 401;
    throw e;
  }
  // V1 明文比对(灾时快速开号);生产换 bcrypt
  if (!user.passwordHash || user.passwordHash !== password) {
    const e = new Error('密码错误');
    e.status = 401;
    throw e;
  }
  user.lastLoginAt = new Date();
  await user.save();

  const token = jwt.sign({ sub: user.username, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
  return { token, user: { username: user.username, name: user.name, role: user.role } };
}

/**
 * 开发态:确保存在默认管理员账号(仅 NODE_ENV !== production 时)。
 */
export async function ensureDevAdmin() {
  if (env.isProd) return;
  const exists = await User.findOne({ username: 'admin' }).exec();
  if (!exists) {
    await User.create({
      username: 'admin',
      name: '默认管理员',
      role: Role.ADMIN,
      passwordHash: 'admin123',
    });
    console.log('[auth] 已创建默认管理员 admin / admin123(仅开发态)');
  }
}
