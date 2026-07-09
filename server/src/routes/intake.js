/**
 * 智能录入路由 —— AI 辅助批量信息整理。
 *
 *   POST /api/intake/parse    预览:文本/链接 → 拆解条目(不入库)
 *   POST /api/intake/import   入库:勾选确认的条目 → 批量创建
 */
import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { ok } from '../utils/response.js';
import { parseIntake, importIntake } from '../services/intakeService.js';

export const router = Router();

function actor(req) {
  return {
    actorId: req.body?.actorId || req.headers['x-actor-id'] || 'intake-operator',
    source: req.body?.source || 'intake',
  };
}

// 预览
router.post('/intake/parse', asyncHandler(async (req, res) => {
  const result = await parseIntake({
    text: req.body.text,
    url: req.body.url,
  });
  const msg = result.degraded
    ? `已用规则提取 ${result.items.length} 条(AI 未配置,建议配置以提升准确度)`
    : `AI 拆解出 ${result.items.length} 条,请核对后入库`;
  res.json(ok(result, msg));
}));

// 批量入库
router.post('/intake/import', asyncHandler(async (req, res) => {
  const items = req.body.items;
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json(ok(null, '请提供条目数组'));
  }
  const { actorId, source, eventId } = actor(req);
  const result = await importIntake(items, { actorId, source, eventId: req.body.eventId });
  const msg = `成功入库 ${result.created.length} 条` + (result.failed.length ? `,失败 ${result.failed.length} 条` : '');
  res.status(201).json(ok(result, msg));
}));
