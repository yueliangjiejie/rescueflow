/**
 * 对接服务 —— 认领、状态流转、超时、供需匹配看板。
 *
 * 让信息墙成为真实流转工具:每条对接都有承诺、有进度、有留痕。
 */
import { Match, MATCH_TRANSITIONS } from '../models/Match.js';
import { Help } from '../models/Help.js';
import { Offer } from '../models/Offer.js';
import { genId } from './idService.js';
import { appendAudit } from './auditService.js';
import { AuditAction } from '@rescueflow/shared';

function bad(msg, status = 400) { const e = new Error(msg); e.status = status; return e; }

// 响应超时阈值:requested 状态超过 2 小时未响应 → overdue
const RESPOND_TIMEOUT_MS = 2 * 3600000;

// ===== 创建认领/对接 =====
/**
 * 供给方/志愿者认领某条需求,或主动发起对接。
 */
export async function createMatch({ helpCode, offerCode, fulfillerId, fulfillerName, fulfillerPhone, fulfillerOrg, requesterId, note, quantity, estimatedArrival, actorId, actorRole }) {
  const help = await Help.findOne({ code: helpCode }).exec();
  if (!help) throw bad('需求不存在', 404);

  // 认领人必须留联系方式 —— 这是"对接"能落地的关键
  if (!fulfillerName || !fulfillerPhone) {
    throw bad('认领请填写您的姓名和电话,需求方需要联系您');
  }

  // 防重复:同一电话对同一需求的活跃对接
  const existing = await Match.findOne({ helpCode, fulfillerPhone, status: { $in: ['requested', 'accepted', 'in_transit', 'delivered'] } }).exec();
  if (existing) throw bad('您已认领过这条,请勿重复', 409);

  const code = 'MATCH-GX-2026-' + (await genId('MATCH', { region: 'GX' })).split('-').pop();
  const match = await Match.create({
    code,
    helpCode,
    offerCode: offerCode || null,
    requesterId: requesterId || help.createdBy || '',
    fulfillerId: fulfillerId || actorId || '',
    fulfillerName,
    fulfillerPhone,
    fulfillerOrg: fulfillerOrg || '',
    status: 'requested',
    note: note || '',
    quantity: quantity ?? null,
    estimatedArrival: estimatedArrival || null,
    respondDeadline: new Date(Date.now() + RESPOND_TIMEOUT_MS),
  });

  await appendAudit({
    entityType: 'match', entityId: code,
    action: AuditAction.CREATE, actorId: actorId || fulfillerId || '', actorRole: actorRole || '',
    summary: `${fulfillerName}(${fulfillerPhone})认领需求 ${helpCode}` + (fulfillerOrg ? ` [${fulfillerOrg}]` : ''),
    toStatus: 'requested',
  });

  // 标记供给为 matched(如有)
  if (offerCode) await Offer.updateOne({ code: offerCode }, { status: 'matched' }).exec();

  return match;
}

// ===== 状态流转 =====
export async function transitionMatch(code, toStatus, opts = {}) {
  const match = await Match.findOne({ code }).exec();
  if (!match) throw bad('对接不存在', 404);

  const allowed = MATCH_TRANSITIONS[match.status] || [];
  if (!allowed.includes(toStatus)) throw bad(`不允许从 ${match.status} 转为 ${toStatus}`);

  const fromStatus = match.status;
  match.status = toStatus;
  const now = new Date();
  if (toStatus === 'accepted') match.acceptedAt = now;
  if (toStatus === 'delivered') match.deliveredAt = now;
  if (toStatus === 'completed') match.completedAt = now;
  if (opts.note) match.note = opts.note;
  if (opts.quantity != null) match.quantity = opts.quantity;
  await match.save();

  await appendAudit({
    entityType: 'match', entityId: code,
    action: AuditAction.TRANSITION, fromStatus, toStatus,
    actorId: opts.actorId || '', actorRole: opts.actorRole || '',
    summary: `${fromStatus} → ${toStatus}` + (opts.note ? `:${opts.note}` : ''),
  });

  // 完成后:若需求脱险,联动标记;释放供给
  if (toStatus === 'completed') {
    if (match.offerCode) await Offer.updateOne({ code: match.offerCode }, { status: 'fulfilled' }).exec();
  }
  if (toStatus === 'cancelled') {
    if (match.offerCode) await Offer.updateOne({ code: match.offerCode }, { status: 'available' }).exec();
  }

  return match;
}

// 便捷封装
export const acceptMatch = (code, opts) => transitionMatch(code, 'accepted', opts);
export const markInTransit = (code, opts) => transitionMatch(code, 'in_transit', opts);
export const markDelivered = (code, opts) => transitionMatch(code, 'delivered', opts);
export const completeMatch = (code, opts) => transitionMatch(code, 'completed', opts);
export const cancelMatch = (code, opts) => transitionMatch(code, 'cancelled', opts);

// ===== 查询 =====
export async function listMatches({ helpCode, fulfillerId, status, page = 1, pageSize = 50 } = {}) {
  const filter = {};
  if (helpCode) filter.helpCode = helpCode;
  if (fulfillerId) filter.fulfillerId = fulfillerId;
  if (status) filter.status = status;
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    Match.find(filter).sort({ requestedAt: -1 }).skip(skip).limit(pageSize).lean().exec(),
    Match.countDocuments(filter).exec(),
  ]);
  return { items, total, page, pageSize };
}

/** 某条需求的全部对接历史。 */
export async function matchHistory(helpCode) {
  return Match.find({ helpCode }).sort({ requestedAt: 1 }).lean().exec();
}

// ===== 超时检测(定时任务调用)=====
export async function refreshOverdue() {
  const res = await Match.updateMany(
    {
      status: 'requested',
      respondDeadline: { $lt: new Date() },
      isOverdue: { $ne: true },
    },
    { $set: { isOverdue: true } }
  ).exec();
  return res.modifiedCount;
}

// ===== 供需匹配看板 =====
/**
 * 全局供需态势:
 *   - gaps:有需求但无供给的类别(缺口,指挥部该动员)
 *   - idle:有供给但无人认领(闲置,该推送)
 *   - pendingMatches:待响应/对接中的列表(流转中)
 *   - stats:汇总数字
 */
export async function matchDashboard() {
  const [activeHelps, activeOffers, activeMatches] = await Promise.all([
    Help.find({ status: { $nin: ['done', 'archived', 'abnormal'] } }).lean().exec(),
    Offer.find({ status: { $in: ['available', 'matched'] } }).lean().exec(),
    Match.find({ status: { $in: ['requested', 'accepted', 'in_transit', 'delivered'] } }).lean().exec(),
  ]);

  // 按类别聚合
  const needCats = {}; // {category: [helpCodes]}
  for (const h of activeHelps) {
    const cats = (h.content?.needs || []).concat(['求助']);
    for (const c of cats) {
      const key = String(c).trim() || '求助';
      if (!needCats[key]) needCats[key] = [];
      needCats[key].push(h.code);
    }
  }
  const offerCats = {}; // {category: [offerCodes]}
  for (const o of activeOffers) {
    const key = (o.category || o.type || '').trim() || '其他';
    if (!offerCats[key]) offerCats[key] = [];
    offerCats[key].push(o.code);
  }

  // 缺口:需求类别里没有对应供给的(粗匹配:需求关键词 ∈ 供给类别/标题)
  const allOfferText = activeOffers.map((o) => `${o.category} ${o.title}`).join(' ');
  const gaps = Object.entries(needCats)
    .filter(([cat]) => !allOfferText.includes(cat) && !Object.keys(offerCats).some((k) => k.includes(cat) || cat.includes(k)))
    .map(([cat, codes]) => ({ category: cat, needCount: codes.length }))
    .sort((a, b) => b.needCount - a.needCount);

  // 闲置供给:available 但没有进行中匹配
  const matchedOfferCodes = new Set(activeMatches.map((m) => m.offerCode).filter(Boolean));
  const idle = activeOffers.filter((o) => o.status === 'available' && !matchedOfferCodes.has(o.code))
    .map((o) => ({ code: o.code, type: o.type, category: o.category, title: o.title, quantity: o.quantity, unit: o.unit, location: o.location }));

  // 待响应(可能超时)
  const pendingMatches = activeMatches
    .filter((m) => m.status === 'requested')
    .map((m) => ({ code: m.code, helpCode: m.helpCode, offerCode: m.offerCode, fulfillerId: m.fulfillerId, isOverdue: m.isOverdue, requestedAt: m.requestedAt }));

  return {
    stats: {
      activeNeeds: activeHelps.length,
      activeOffers: activeOffers.length,
      inProgressMatches: activeMatches.length,
      overdue: activeMatches.filter((m) => m.isOverdue).length,
      gaps: gaps.length,
      idle: idle.length,
    },
    gaps: gaps.slice(0, 20),
    idle: idle.slice(0, 30),
    pendingMatches: pendingMatches.slice(0, 30),
  };
}
