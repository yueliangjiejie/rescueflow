/**
 * 合规与留痕校验路由。
 *   GET /api/audit/verify?entityType=help&entityId=HELP-...  校验某条留痕链完整性
 *   GET /api/compliance/notice                                合规声明文案(供前端展示)
 */
import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { ok } from '../utils/response.js';
import { verifyAuditChain } from '../services/auditService.js';
import { COMPLIANCE_NOTICE, DATA_RETENTION_DAYS_PROXY } from '../services/complianceService.js';

export const router = Router();

router.get(
  '/audit/verify',
  asyncHandler(async (req, res) => {
    const { entityType, entityId } = req.query;
    if (!entityType || !entityId) return res.status(400).json(ok(null, '需要 entityType 与 entityId'));
    const result = await verifyAuditChain(entityType, entityId);
    res.json(ok(result));
  })
);

router.get('/compliance/notice', (_req, res) => {
  res.json(ok({ notice: COMPLIANCE_NOTICE, retentionDays: DATA_RETENTION_DAYS_PROXY }));
});
