/**
 * 用户模型 —— 管理后台 RBAC。
 * 群众端用 openid 不建表;此处仅后台操作员/志愿者/管理员。
 */
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    role: { type: String, enum: ['volunteer', 'operator', 'admin'], default: 'volunteer' },
    passwordHash: { type: String, default: '' }, // 简易;V1 可用预设账号
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, collection: 'users' }
);

export const User = mongoose.model('User', userSchema);
