/**
 * 管理路由 —— 用户/组织/志愿者管理 + Help 指派核实人/软删除/恢复。
 *
 * 用户:
 *   GET/POST/PUT/DELETE  /api/users
 *   POST /api/users/:id/reset-password
 * 志愿者审批:
 *   GET  /api/volunteers/applications
 *   POST /api/volunteers/:id/approve | /reject
 * 组织(承接方):
 *   GET/POST  /api/organizations
 *   PUT/DELETE /api/organizations/:id
 * Help 管理:
 *   POST /api/admin/helps/:code/assign-verifier  指派核实人
 *   POST /api/admin/helps/:code/delete           软删除(留痕)
 *   POST /api/admin/helps/:code/restore          恢复
 */
import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { ok } from '../utils/response.js';
import { listUsers, createUser, updateUser, deleteUser, resetPassword,
         listVolunteerApplications, approveVolunteer, rejectVolunteer } from '../services/userService.js';
import { listOrgs, createOrg, updateOrg, deleteOrg } from '../services/orgService.js';
import { Help } from '../models/Help.js';
import { appendAudit } from '../services/auditService.js';
import { AuditAction } from '@rescueflow/shared';

export const router = Router();

function actor(req) {
  return {
    actorId: req.body?.actorId || req.headers['x-actor-id'] || 'admin',
    actorRole: req.body?.actorRole || req.headers['x-actor-role'] || 'admin',
  };
}

// ===== 用户管理 =====
router.get('/users', asyncHandler(async (req, res) => {
  res.json(ok(await listUsers({ role: req.query.role, q: req.query.q })));
}));
router.post('/users', asyncHandler(async (req, res) => {
  const u = await createUser(req.body);
  res.status(201).json(ok(u, '已创建(默认密码 123456)'));
}));
router.put('/users/:id', asyncHandler(async (req, res) => {
  res.json(ok(await updateUser(req.params.id, req.body)));
}));
router.delete('/users/:id', asyncHandler(async (req, res) => {
  res.json(ok(await deleteUser(req.params.id), '已停用'));
}));
router.post('/users/:id/reset-password', asyncHandler(async (req, res) => {
  await resetPassword(req.params.id, req.body.password);
  res.json(ok(null, '密码已重置'));
}));

// ===== 志愿者审批 =====
router.get('/volunteers/applications', asyncHandler(async (req, res) => {
  res.json(ok(await listVolunteerApplications({ status: req.query.status != null ? Number(req.query.status) : undefined })));
}));
router.post('/volunteers/:id/approve', asyncHandler(async (req, res) => {
  res.json(ok(await approveVolunteer(req.params.id)));
}));
router.post('/volunteers/:id/reject', asyncHandler(async (req, res) => {
  res.json(ok(await rejectVolunteer(req.params.id)));
}));

// ===== 组织(承接方)管理 =====
router.get('/organizations', asyncHandler(async (req, res) => {
  res.json(ok(await listOrgs({ type: req.query.type, activeOnly: req.query.activeOnly !== 'false' })));
}));
router.post('/organizations', asyncHandler(async (req, res) => {
  const o = await createOrg(req.body);
  res.status(201).json(ok(o, '组织已创建'));
}));
router.put('/organizations/:id', asyncHandler(async (req, res) => {
  res.json(ok(await updateOrg(req.params.id, req.body)));
}));
router.delete('/organizations/:id', asyncHandler(async (req, res) => {
  res.json(ok(await deleteOrg(req.params.id), '已停用'));
}));

// ===== Help 管理:指派核实人 / 软删除 / 恢复 =====
router.post('/admin/helps/:code/assign-verifier', asyncHandler(async (req, res) => {
  const verifier = req.body.verifier;
  if (!verifier) return res.status(400).json(ok(null, '请指定核实人'));
  const h = await Help.findOneAndUpdate(
    { code: req.params.code },
    { assignedVerifier: verifier, assignedAt: new Date() },
    { new: true }
  ).lean().exec();
  if (!h) return res.status(404).json(ok(null, '求助不存在'));
  await appendAudit({
    entityType: 'help', entityId: req.params.code,
    action: AuditAction.UPDATE, ...actor(req),
    summary: `指派核实人:${verifier}`, changes: { assignedVerifier: verifier },
  });
  res.json(ok({ code: h.code, assignedVerifier: h.assignedVerifier }));
}));

router.post('/admin/helps/:code/delete', asyncHandler(async (req, res) => {
  const { actorId } = actor(req);
  const h = await Help.findOneAndUpdate(
    { code: req.params.code },
    { deletedAt: new Date(), deletedBy: actorId },
    { new: true }
  ).lean().exec();
  if (!h) return res.status(404).json(ok(null, '求助不存在'));
  await appendAudit({
    entityType: 'help', entityId: req.params.code,
    action: AuditAction.DELETE, actorId,
    summary: `软删除(可恢复)`, changes: { deletedAt: h.deletedAt },
  });
  res.json(ok({ code: h.code }, '已删除(可恢复)'));
}));

router.post('/admin/helps/:code/restore', asyncHandler(async (req, res) => {
  const h = await Help.findOneAndUpdate(
    { code: req.params.code },
    { $unset: { deletedAt: '', deletedBy: '' } },
    { new: true }
  ).lean().exec();
  if (!h) return res.status(404).json(ok(null, '求助不存在'));
  await appendAudit({
    entityType: 'help', entityId: req.params.code,
    action: AuditAction.UPDATE, ...actor(req), summary: '恢复已删除的求助',
  });
  res.json(ok({ code: h.code }, '已恢复'));
}));
