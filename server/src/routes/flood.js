/**
 * 洪涝场景路由(水位上报 / 报平安 / 道路通行 / 区域态势)。
 *
 * 群众端:
 *   POST /api/water-levels           上报水位
 *   POST /api/safety                 报平安
 *   GET  /api/safety/search          寻亲查询(?name=&phone=)
 *   POST /api/roads                  上报道路通行
 *
 * 看板(管理后台):
 *   GET  /api/dashboard/water-map    水位涨势地图
 *   GET  /api/dashboard/regions      区域态势分布
 *   GET  /api/dashboard/overview     全局总览(求助/安置/物资/水位)
 *   GET  /api/roads                  道路通行列表
 */
import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { ok } from '../utils/response.js';
import { reportWaterLevel, latestWaterLevels, regionBreakdown } from '../services/waterLevelService.js';
import { reportSafe, searchSafety, reportRoad, listRoads } from '../services/floodService.js';
import { Shelter } from '../models/Shelter.js';
import { Help } from '../models/Help.js';

export const router = Router();

// ===== 群众端:水位上报 =====
router.post('/water-levels', asyncHandler(async (req, res) => {
  const doc = await reportWaterLevel({
    location: req.body.location,
    coordinates: req.body.coordinates,
    province: req.body.province,
    city: req.body.city,
    district: req.body.district,
    level: req.body.level,
    trend: req.body.trend,
    depthCm: req.body.depthCm,
    description: req.body.description,
    reporterId: req.headers['x-openid'] || 'anonymous',
    reporterRole: req.body.reporterRole || 'public',
    eventId: req.body.eventId,
  });
  res.status(201).json(ok({ id: doc._id, level: doc.level }, '水位已上报'));
}));

// ===== 报平安 =====
router.post('/safety', asyncHandler(async (req, res) => {
  if (!req.body.name) return res.status(400).json(ok(null, '请填写姓名'));
  const doc = await reportSafe({
    name: req.body.name,
    phone: req.body.phone,
    status: req.body.status,
    message: req.body.message,
    currentLocation: req.body.currentLocation,
    shelterId: req.body.shelterId,
    helpCode: req.body.helpCode,
    eventId: req.body.eventId,
  });
  res.status(201).json(ok({ id: doc._id }, '已报平安'));
}));

// 寻亲查询(公开,任何人可查)
router.get('/safety/search', asyncHandler(async (req, res) => {
  const list = await searchSafety({
    name: req.query.name,
    phone: req.query.phone,
    status: req.query.status,
  });
  res.json(ok(list));
}));

// ===== 道路通行 =====
router.post('/roads', asyncHandler(async (req, res) => {
  if (!req.body.roadName) return res.status(400).json(ok(null, '请填写道路名'));
  const doc = await reportRoad({
    roadName: req.body.roadName,
    coordinates: req.body.coordinates,
    status: req.body.status,
    waterLevel: req.body.waterLevel,
    description: req.body.description,
    reporterId: req.headers['x-openid'] || 'anonymous',
    eventId: req.body.eventId,
  });
  res.status(201).json(ok({ id: doc._id }, '道路信息已上报'));
}));

router.get('/roads', asyncHandler(async (req, res) => {
  const list = await listRoads({ status: req.query.status });
  res.json(ok(list));
}));

// ===== 看板 =====
router.get('/dashboard/water-map', asyncHandler(async (req, res) => {
  const list = await latestWaterLevels({ hours: Number(req.query.hours) || 24 });
  res.json(ok(list));
}));

router.get('/dashboard/regions', asyncHandler(async (req, res) => {
  const list = await regionBreakdown({ hours: Number(req.query.hours) || 24 });
  res.json(ok(list));
}));

// 全局总览:指挥部一眼看全局
router.get('/dashboard/overview', asyncHandler(async (_req, res) => {
  const [helpsByStatus, shelters, shelterTotal] = await Promise.all([
    Help.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).exec(),
    Shelter.aggregate([
      { $group: { _id: null, total: { $sum: '$totalCapacity' }, inmates: { $sum: '$inmates' }, shelters: { $sum: 1 } } },
    ]).exec(),
    Help.countDocuments({ status: { $nin: ['done', 'archived'] } }),
  ]);

  const statusMap = {};
  helpsByStatus.forEach((s) => { statusMap[s._id] = s.count; });

  const shelterInfo = shelters[0] || { total: 0, inmates: 0, shelters: 0 };

  res.json(ok({
    helps: {
      pending: statusMap.pending || 0,
      verified: statusMap.verified || 0,
      transferred: statusMap.transferred || 0,
      inProgress: statusMap.in_progress || 0,
      done: statusMap.done || 0,
      abnormal: statusMap.abnormal || 0,
      active: shelterTotal,
    },
    shelters: {
      count: shelterInfo.shelters || 0,
      totalCapacity: shelterInfo.total || 0,
      inmates: shelterInfo.inmates || 0,
      occupancy: shelterInfo.total ? Math.round((shelterInfo.inmates / shelterInfo.total) * 100) : 0,
    },
  }));
}));
