/**
 * 志愿者与技能路由(借鉴 DRAP 志愿者管理 + 技能匹配)。
 *
 *   GET  /api/skills                 技能字典
 *   POST /api/volunteers/apply       提交志愿者申请(需 userId)
 *   GET  /api/volunteers             列表(管理员)
 *   POST /api/volunteers/:id/review  审批(管理员)
 *   GET  /api/volunteers/match       按技能匹配空闲志愿者(派单用)
 *   POST /api/helps/:code/claim      认领求助
 *   POST /api/helps/:code/unclaim    取消认领
 *   POST /api/helps/:code/resolve    标记脱险 + 录入成果
 */
import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { ok } from '../utils/response.js';
import { Skill } from '../models/Skill.js';
import { matchVolunteers, applyVolunteer, reviewVolunteer } from '../services/volunteerService.js';
import { claim, unclaim, setResolved } from '../services/helpFlowService.js';

export const router = Router();

function actor(req) {
  return {
    actorId: req.body?.actorId || req.query.actorId || req.headers['x-actor-id'] || 'unknown',
    actorRole: req.body?.actorRole || req.query.actorRole || req.headers['x-actor-role'] || 'volunteer',
  };
}

// 技能字典
router.get('/skills', asyncHandler(async (_req, res) => {
  const list = await Skill.find().sort({ category: 1, name: 1 }).lean().exec();
  res.json(ok(list));
}));

// 申请成为志愿者
router.post('/volunteers/apply', asyncHandler(async (req, res) => {
  const v = await applyVolunteer(req.body.userId, {
    skills: req.body.skills || [],
    idProof: req.body.idProof,
    experienceCertificate: req.body.experienceCertificate,
    serviceArea: req.body.serviceArea,
  });
  res.status(201).json(ok({ id: v._id, applicationStatus: v.applicationStatus }, '申请已提交,待审核'));
}));

// 志愿者列表
router.get('/volunteers', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.skill) filter.skills = req.query.skill;
  if (req.query.applicationStatus) filter.applicationStatus = Number(req.query.applicationStatus);
  const { default: V } = await import('../models/Volunteer.js');
  const list = await V.find(filter).lean().exec();
  res.json(ok(list));
}));

// 审批
router.post('/volunteers/:id/review', asyncHandler(async (req, res) => {
  const v = await reviewVolunteer(req.params.id, Number(req.body.status));
  res.json(ok({ id: v._id, applicationStatus: v.applicationStatus }));
}));

// 匹配空闲志愿者(按技能 + 可用性)
router.get('/volunteers/match', asyncHandler(async (req, res) => {
  const list = await matchVolunteers({
    skill: req.query.skill,
    needs: req.query.needs ? String(req.query.needs).split(',') : [],
    limit: Number(req.query.limit) || 20,
  });
  res.json(ok(list));
}));

// 认领求助
router.post('/helps/:code/claim', asyncHandler(async (req, res) => {
  const h = await claim(req.params.code, { ...actor(req), force: !!req.body.force });
  res.json(ok({ code: h.code, claimedBy: h.claimedBy }));
}));

// 取消认领
router.post('/helps/:code/unclaim', asyncHandler(async (req, res) => {
  const h = await unclaim(req.params.code, actor(req));
  res.json(ok({ code: h.code, claimedBy: null }));
}));

// 标记脱险 + 成果录入
router.post('/helps/:code/resolve', asyncHandler(async (req, res) => {
  const h = await setResolved(req.params.code, req.body.resolved !== false, {
    rescued: req.body.rescued,
    treated: req.body.treated,
    missing: req.body.missing,
    note: req.body.note,
  }, actor(req));
  res.json(ok({ code: h.code, resolved: h.resolved, outcome: h.outcome }));
}));
