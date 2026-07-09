/**
 * 用户管理服务 —— 管理后台操作员/志愿者/管理员。
 * 含:CRUD、角色变更、志愿者审批、重置密码。
 */
import { User } from '../models/User.js';
import { Volunteer } from '../models/Volunteer.js';
import crypto from 'node:crypto';

export async function listUsers({ role, q } = {}) {
  const filter = {};
  if (role) filter.role = role;
  if (q) filter.$or = [{ username: new RegExp(q, 'i') }, { name: new RegExp(q, 'i') }, { phone: new RegExp(q) }];
  return User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).lean().exec();
}

export async function createUser(input) {
  if (!input.username) throw Object.assign(new Error('用户名必填'), { status: 400 });
  const exists = await User.findOne({ username: input.username });
  if (exists) throw Object.assign(new Error('用户名已存在'), { status: 409 });
  return User.create({
    username: input.username,
    name: input.name || input.username,
    phone: input.phone || '',
    role: input.role || 'volunteer',
    passwordHash: input.password || '123456', // V1 明文(灾时快速开号),生产换 bcrypt
    active: input.active !== false,
  });
}

export async function updateUser(id, patch) {
  const allowed = ['name', 'phone', 'role', 'active'];
  const upd = {};
  for (const k of allowed) if (patch[k] !== undefined) upd[k] = patch[k];
  return User.findByIdAndUpdate(id, upd, { new: true }).select('-passwordHash').lean().exec();
}

export async function deleteUser(id) {
  // 软删除:停用
  return User.findByIdAndUpdate(id, { active: false }, { new: true }).lean().exec();
}

export async function resetPassword(id, newPwd) {
  return User.findByIdAndUpdate(id, { passwordHash: newPwd || '123456' }).lean().exec();
}

// 志愿者申请审批
export async function listVolunteerApplications({ status } = {}) {
  const filter = {};
  if (status != null) filter.applicationStatus = Number(status);
  return Volunteer.find(filter).populate('userId', 'username name phone').sort({ createdAt: -1 }).lean().exec();
}

export async function approveVolunteer(volunteerId) {
  return Volunteer.findByIdAndUpdate(volunteerId, { applicationStatus: 1 }, { new: true }).lean().exec();
}

export async function rejectVolunteer(volunteerId) {
  return Volunteer.findByIdAndUpdate(volunteerId, { applicationStatus: 2 }, { new: true }).lean().exec();
}
