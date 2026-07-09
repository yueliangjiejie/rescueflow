/**
 * 避难所/灾民/物资路由(移植自 DRAP,灾时核心能力)。
 *
 *   GET  /api/resource-types            物资类型字典
 *   GET  /api/shelters                  避难所列表(?eventId=&availableOnly=)
 *   POST /api/shelters                  新建避难所
 *   GET  /api/shelters/:id              详情
 *   POST /api/shelters/:id/inmates      灾民登记入住
 *   POST /api/inmates/:id/checkout      灾民离开
 *   GET  /api/inmates/search            寻亲查询(?name=&contact=)
 *   POST /api/resource-flows            物资流水(调拨/消耗/捐赠)
 *   GET  /api/inventory                 库存汇总(?shelterId=&eventId=)
 */
import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { ok } from '../utils/response.js';
import {
  createShelter, listShelters, getShelter,
  checkInInmate, checkOutInmate, searchInmates,
  addResourceFlow, inventorySummary, listResourceTypes,
} from '../services/shelterService.js';

export const router = Router();

function actor(req) {
  return {
    operatorId: req.body?.operatorId || req.headers['x-actor-id'] || 'unknown',
    operatorName: req.body?.operatorName || '',
  };
}

// 物资类型字典
router.get('/resource-types', asyncHandler(async (_req, res) => {
  res.json(ok(await listResourceTypes()));
}));

// 避难所列表
router.get('/shelters', asyncHandler(async (req, res) => {
  const list = await listShelters({
    eventId: req.query.eventId,
    availableOnly: req.query.availableOnly === 'true',
  });
  res.json(ok(list));
}));

// 新建避难所
router.post('/shelters', asyncHandler(async (req, res) => {
  const s = await createShelter({
    name: req.body.name,
    location: req.body.location,
    coordinates: req.body.coordinates,
    totalCapacity: req.body.totalCapacity,
    contactDetails: req.body.contactDetails,
    assignedVolunteer: req.body.assignedVolunteer,
    eventId: req.body.eventId,
  });
  res.status(201).json(ok({ id: s._id, code: s.code, available: s.available }, '避难所已创建'));
}));

// 避难所详情
router.get('/shelters/:id', asyncHandler(async (req, res) => {
  const s = await getShelter(req.params.id);
  if (!s) return res.status(404).json(ok(null, '未找到'));
  res.json(ok(s));
}));

// 灾民登记入住
router.post('/shelters/:id/inmates', asyncHandler(async (req, res) => {
  const inmate = await checkInInmate({
    name: req.body.name,
    place: req.body.place,
    age: req.body.age,
    contact: req.body.contact,
    shelterId: req.params.id,
    eventId: req.body.eventId,
    specialPersons: req.body.specialPersons,
  });
  res.status(201).json(ok({ id: inmate._id }, '登记成功'));
}));

// 灾民离开
router.post('/inmates/:id/checkout', asyncHandler(async (req, res) => {
  const inmate = await checkOutInmate(req.params.id);
  res.json(ok({ id: inmate?._id, status: inmate?.status }));
}));

// 寻亲查询
router.get('/inmates/search', asyncHandler(async (req, res) => {
  const list = await searchInmates({
    name: req.query.name,
    contact: req.query.contact,
    shelterId: req.query.shelterId,
    eventId: req.query.eventId,
  });
  res.json(ok(list));
}));

// 物资流水
router.post('/resource-flows', asyncHandler(async (req, res) => {
  const { operatorId, operatorName } = actor(req);
  const flow = await addResourceFlow({
    shelterId: req.body.shelterId,
    type: req.body.type,
    resources: req.body.resources,
    operatorId, operatorName,
    fromParty: req.body.fromParty,
    note: req.body.note,
    eventId: req.body.eventId,
  });
  res.status(201).json(ok({ id: flow._id }, '物资流水已记录'));
}));

// 库存汇总
router.get('/inventory', asyncHandler(async (req, res) => {
  const summary = await inventorySummary({
    shelterId: req.query.shelterId,
    eventId: req.query.eventId,
  });
  res.json(ok(summary));
}));
