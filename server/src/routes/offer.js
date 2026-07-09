/**
 * 互助路由 —— 公开信息墙 + 供给发布 + 供需匹配。
 *
 *   GET  /api/feed                 信息墙(需求+供给合流,可筛选排序)
 *   POST /api/offers               发布供给
 *   GET  /api/offers               供给列表
 *   GET  /api/offers/match?help=HELP-xxx  为某需求匹配候选供给
 */
import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { ok } from '../utils/response.js';
import { maskPhone } from '../services/privacyService.js';
import { createOffer, listOffers, feedWall, matchOffersForHelp } from '../services/offerService.js';

export const router = Router();

// 信息墙(公开)
router.get('/feed', asyncHandler(async (req, res) => {
  const result = await feedWall({
    kind: req.query.kind || 'all',      // all | need | offer
    category: req.query.category,
    sort: req.query.sort || 'latest',   // latest | urgent
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
  });
  // 信息墙统一脱敏手机号
  result.items = result.items.map((it) => ({ ...it, phone: maskPhone(it.phone) }));
  res.json(ok(result));
}));

// 发布供给
router.post('/offers', asyncHandler(async (req, res) => {
  if (!req.body.title || !req.body.type) return res.status(400).json(ok(null, '请填写标题和类型'));
  const o = await createOffer({
    type: req.body.type,
    category: req.body.category,
    title: req.body.title,
    description: req.body.description,
    quantity: req.body.quantity,
    unit: req.body.unit,
    providerName: req.body.providerName,
    providerPhone: req.body.providerPhone,
    providerOrg: req.body.providerOrg,
    location: req.body.location,
    coordinates: req.body.coordinates,
    canDeliver: req.body.canDeliver,
    validUntil: req.body.validUntil,
    eventId: req.body.eventId,
  });
  res.status(201).json(ok({ code: o.code }, '已发布到互助墙'));
}));

// 供给列表
router.get('/offers', asyncHandler(async (req, res) => {
  const result = await listOffers({
    type: req.query.type,
    category: req.query.category,
    status: req.query.status,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
  });
  res.json(ok(result));
}));

// 供需匹配
router.get('/offers/match', asyncHandler(async (req, res) => {
  if (!req.query.help) return res.status(400).json(ok(null, '需提供 help 编号'));
  const result = await matchOffersForHelp(req.query.help, { limit: Number(req.query.limit) || 10 });
  res.json(ok(result));
}));
