/**
 * 管理后台路由。
 *
 *   GET    /api/admin/helps           列表(筛选 + 排序)
 *   GET    /api/admin/helps/:code     详情
 *   GET    /api/admin/helps/:code/audit   留痕链
 *   POST   /api/admin/helps/:code/transition  状态流转
 *   POST   /api/admin/helps/:code/verify      核实(+可信度)
 *   POST   /api/admin/helps/:code/transfer    转交
 *   POST   /api/admin/helps/:code/abnormal    标记异常
 *   GET    /api/admin/helps/:code/reveal      解码明文(写 VIEW 留痕)
 *   GET    /api/admin/export                  导出 Excel
 *
 * 注:鉴权/RBAC 在阶段3接入;此处默认信任(预留 actorId/role 入参)。
 */
import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { ok } from '../utils/response.js';
import { maskHelp, maskHelps, maskPhone, maskName } from '../services/privacyService.js';
import { Help } from '../models/Help.js';
import { listHelps, getHelp } from '../services/helpService.js';
import { transition } from '../services/helpFlowService.js';
import { exportHelpsToBuffer } from '../services/exportService.js';
import { appendAudit } from '../services/auditService.js';
import { AuditLog } from '../models/AuditLog.js';
import { detectDuplicate } from '../services/duplicateService.js';
import { AuditAction, HelpAbnormalReason } from '@rescueflow/shared';

export const router = Router();

// 公共 actor 提取(阶段3由 JWT 中间件填充)
function actor(req) {
  return {
    actorId: req.body?.actorId || req.query.actorId || req.headers['x-actor-id'] || 'unknown',
    actorRole: req.body?.actorRole || req.query.actorRole || req.headers['x-actor-role'] || 'operator',
  };
}

// 列表(支持 status/urgency/keyword/排序)
router.get(
  '/admin/helps',
  asyncHandler(async (req, res) => {
    const result = await listHelps({
      status: req.query.status,
      urgency: req.query.urgency,
      q: req.query.q,
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 20,
    });
    res.json(ok({ ...result, items: maskHelps(result.items) }));
  })
);

// 详情
router.get(
  '/admin/helps/:code',
  asyncHandler(async (req, res) => {
    const doc = await getHelp(req.params.code);
    if (!doc) return res.status(404).json(ok(null, '未找到'));
    res.json(ok(maskHelp(doc)));
  })
);

// 留痕链
router.get(
  '/admin/helps/:code/audit',
  asyncHandler(async (req, res) => {
    const logs = await AuditLog.find({ entityType: 'help', entityId: req.params.code })
      .sort({ seq: 1 })
      .lean()
      .exec();
    res.json(ok(logs));
  })
);

// 状态流转(通用)
router.post(
  '/admin/helps/:code/transition',
  asyncHandler(async (req, res) => {
    const doc = await transition(req.params.code, req.body.toStatus, {
      ...actor(req),
      abnormalReason: req.body.abnormalReason,
      credibility: req.body.credibility,
      urgency: req.body.urgency,
      transferredTo: req.body.transferredTo,
      summary: req.body.summary,
    });
    res.json(ok({ code: doc.code, status: doc.status }));
  })
);

// 核实(含可信度评定)
router.post(
  '/admin/helps/:code/verify',
  asyncHandler(async (req, res) => {
    const doc = await transition(req.params.code, 'verified', {
      ...actor(req),
      credibility: req.body.credibility || 3,
      urgency: req.body.urgency,
      summary: req.body.note ? `核实:${req.body.note}` : '核实通过',
    });
    await appendAudit({
      entityType: 'help',
      entityId: req.params.code,
      action: AuditAction.VERIFY,
      actorId: actor(req).actorId,
      summary: `评定可信度 ${'★'.repeat(req.body.credibility || 3)}`,
      changes: { credibility: req.body.credibility },
    });
    res.json(ok({ code: doc.code, status: doc.status, credibility: doc.credibility }));
  })
);

// 转交
router.post(
  '/admin/helps/:code/transfer',
  asyncHandler(async (req, res) => {
    if (!req.body.transferredTo) return res.status(400).json(ok(null, '需指定转交去向'));
    const doc = await transition(req.params.code, 'transferred', {
      ...actor(req),
      transferredTo: req.body.transferredTo,
      summary: `转交至:${req.body.transferredTo}`,
    });
    res.json(ok({ code: doc.code, status: doc.status }));
  })
);

// 标记异常
router.post(
  '/admin/helps/:code/abnormal',
  asyncHandler(async (req, res) => {
    const doc = await transition(req.params.code, 'abnormal', {
      ...actor(req),
      abnormalReason: req.body.reason,
      summary: `标记异常:${req.body.reason}`,
    });
    res.json(ok({ code: doc.code, status: doc.status, abnormalReason: doc.abnormalReason }));
  })
);

// 解码明文手机号/姓名(写 VIEW 留痕,符合"敏感信息访问留痕")
router.get(
  '/admin/helps/:code/reveal',
  asyncHandler(async (req, res) => {
    const doc = await getHelp(req.params.code);
    if (!doc) return res.status(404).json(ok(null, '未找到'));
    await appendAudit({
      entityType: 'help',
      entityId: req.params.code,
      action: AuditAction.VIEW,
      actorId: actor(req).actorId,
      summary: '查看明文联系方式',
    });
    res.json(ok({ phone: doc.person?.phone || '', name: doc.person?.name || '' }));
  })
);

// 重复检测:对单条求助检查疑似重复(人工确认用)
router.get(
  '/admin/helps/:code/duplicates',
  asyncHandler(async (req, res) => {
    const doc = await getHelp(req.params.code);
    if (!doc) return res.status(404).json(ok(null, '未找到'));
    const lng = doc.location?.coordinates?.[0];
    const lat = doc.location?.coordinates?.[1];
    const result = await detectDuplicate({
      text: doc.content?.rawText || doc.content?.summary || '',
      phone: doc.person?.phone,
      lng, lat,
      submittedAt: doc.submittedAt,
      excludeCode: doc.code,
    });
    res.json(ok(result));
  })
);

// 合并重复:把 dupCode 标记为 abnormal=duplicate,留痕指向主条 keepCode
router.post(
  '/admin/helps/merge',
  asyncHandler(async (req, res) => {
    const { keepCode, dupCode } = req.body || {};
    if (!keepCode || !dupCode) return res.status(400).json(ok(null, '需提供 keepCode 与 dupCode'));
    const doc = await transition(dupCode, 'abnormal', {
      ...actor(req),
      abnormalReason: HelpAbnormalReason.DUPLICATE,
      summary: `合并为重复,正本 ${keepCode}`,
    });
    await appendAudit({
      entityType: 'help',
      entityId: keepCode,
      action: AuditAction.UPDATE,
      actorId: actor(req).actorId,
      summary: `合并重复项 ${dupCode}`,
    });
    res.json(ok({ merged: dupCode, into: keepCode }));
  })
);

// 导出 Excel
router.get(
  '/admin/export',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.urgency) filter.urgency = req.query.urgency;
    const revealPhone = req.query.revealPhone === 'true';
    const buf = await exportHelpsToBuffer({ filter, revealPhone });
    await appendAudit({
      entityType: 'help',
      entityId: '*',
      action: AuditAction.EXPORT,
      actorId: actor(req).actorId,
      summary: `导出 ${revealPhone ? '(含明文)' : '(脱敏)'} ${JSON.stringify(filter)}`,
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="helps-${Date.now()}.xlsx"`);
    res.send(buf);
  })
);
