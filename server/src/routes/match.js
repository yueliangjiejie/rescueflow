/**
 * 认领/对接路由 —— 把信息墙变真实流转工具。
 *
 * 群众端:
 *   POST /api/matches                认领需求 / 发起对接
 *   GET  /api/matches?helpCode=      某需求的对接历史
 *   GET  /api/matches?fulfillerId=   我认领的
 *   POST /api/matches/:code/accept   接受
 *   POST /api/matches/:code/transit  配送中
 *   POST /api/matches/:code/deliver  已送达
 *   POST /api/matches/:code/complete 已完成
 *   POST /api/matches/:code/cancel   取消
 *
 * 后台:
 *   GET  /api/dashboard/match        供需匹配看板(缺口/闲置/待响应)
 */
import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { ok } from '../utils/response.js';
import {
  createMatch, listMatches, matchHistory,
  acceptMatch, markInTransit, markDelivered, completeMatch, cancelMatch,
  matchDashboard,
} from '../services/matchService.js';

export const router = Router();

function actor(req) {
  return {
    actorId: req.body?.actorId || req.query.actorId || req.headers['x-actor-id'] || 'unknown',
    actorRole: req.body?.actorRole || req.query.actorRole || req.headers['x-actor-role'] || 'public',
  };
}

// 认领/发起对接
router.post('/matches', asyncHandler(async (req, res) => {
  if (!req.body.helpCode) return res.status(400).json(ok(null, '请提供 helpCode'));
  const { actorId, actorRole } = actor(req);
  const m = await createMatch({
    helpCode: req.body.helpCode,
    offerCode: req.body.offerCode,
    fulfillerId: req.body.fulfillerId || actorId,
    fulfillerName: req.body.fulfillerName,
    fulfillerPhone: req.body.fulfillerPhone,
    fulfillerOrg: req.body.fulfillerOrg,
    requesterId: req.body.requesterId,
    note: req.body.note,
    quantity: req.body.quantity,
    estimatedArrival: req.body.estimatedArrival,
    actorId, actorRole,
  });
  res.status(201).json(ok({ code: m.code, status: m.status }, '认领成功,等待响应'));
}));

// 列表(按 helpCode 或 fulfillerId 或 status)
router.get('/matches', asyncHandler(async (req, res) => {
  if (req.query.helpCode) {
    return res.json(ok(await matchHistory(req.query.helpCode)));
  }
  const result = await listMatches({
    helpCode: req.query.helpCode,
    fulfillerId: req.query.fulfillerId,
    status: req.query.status,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
  });
  res.json(ok(result));
}));

// 状态流转(统一封装)
async function doTransition(fn, req, res) {
  const m = await fn(req.params.code, { ...actor(req), note: req.body.note, quantity: req.body.quantity });
  res.json(ok({ code: m.code, status: m.status }));
}
router.post('/matches/:code/accept', asyncHandler(async (req, res) => doTransition(acceptMatch, req, res)));
router.post('/matches/:code/transit', asyncHandler(async (req, res) => doTransition(markInTransit, req, res)));
router.post('/matches/:code/deliver', asyncHandler(async (req, res) => doTransition(markDelivered, req, res)));
router.post('/matches/:code/complete', asyncHandler(async (req, res) => doTransition(completeMatch, req, res)));
router.post('/matches/:code/cancel', asyncHandler(async (req, res) => doTransition(cancelMatch, req, res)));

// 供需匹配看板
router.get('/dashboard/match', asyncHandler(async (_req, res) => {
  res.json(ok(await matchDashboard()));
}));
