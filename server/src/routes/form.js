/**
 * 表单路由(多灾种自定义表单,Ushahidi 借鉴)。
 *   GET /api/forms          表单列表(群众端/后台用)
 *   GET /api/forms/:slug    表单详情(含字段定义,渲染动态表单)
 */
import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { ok } from '../utils/response.js';
import { listForms, getForm } from '../services/formService.js';

export const router = Router();

router.get('/forms', asyncHandler(async (req, res) => {
  const list = await listForms({ includeDisabled: req.query.includeDisabled === 'true' });
  res.json(ok(list));
}));

router.get('/forms/:slug', asyncHandler(async (req, res) => {
  const form = await getForm(req.params.slug);
  if (!form) return res.status(404).json(ok(null, '表单不存在'));
  res.json(ok(form));
}));
