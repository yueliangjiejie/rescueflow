/**
 * 公开信息墙服务 —— 需求(Help)+ 供给(Offer)合流,群策群力。
 *
 * 信息墙:任何人都能发布,内容按时间/紧急度排列,公开可查。
 *   - 筛选:全部 / 需帮助 / 能帮忙;按类别
 *   - 排序:最新 / 最紧急(求助的紧急度优先)
 *
 * 供需匹配:针对某条需求,找出同类别、可用、就近的供给(只提示,人工对接)。
 */
import { Help } from '../models/Help.js';
import { Offer } from '../models/Offer.js';
import { Match } from '../models/Match.js';
import { genId } from './idService.js';
import { ID_PREFIX, URGENCY_WEIGHT } from '@rescueflow/shared';

// ===== Offer =====
export async function createOffer(input) {
  const code = await genId(ID_PREFIX.HELP, { region: 'GX' }); // 复用计数器,前缀手动改
  return Offer.create({
    code: 'OFFER-GX-2026-' + code.split('-').pop(),
    type: input.type,
    category: input.category || '',
    title: input.title,
    description: input.description || '',
    quantity: input.quantity ?? null,
    unit: input.unit || '',
    provider: {
      name: input.providerName || '',
      phone: input.providerPhone || '',
      org: input.providerOrg || '',
    },
    location: input.location || '',
    coordinates: input.coordinates || [],
    canDeliver: input.canDeliver || false,
    validUntil: input.validUntil || null,
    eventId: input.eventId || null,
    status: 'available',
  });
}

export async function listOffers({ type, category, status, page = 1, pageSize = 50 } = {}) {
  const filter = {};
  if (type) filter.type = type;
  if (category) filter.category = new RegExp(category, 'i');
  if (status) filter.status = status; else filter.status = { $in: ['available', 'matched'] };

  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    Offer.find(filter).sort({ submittedAt: -1 }).skip(skip).limit(pageSize).lean().exec(),
    Offer.countDocuments(filter).exec(),
  ]);
  return { items, total, page, pageSize };
}

// ===== 信息墙(需求 + 供给合流)=====
/**
 * @param {object} opts { kind: 'all'|'need'|'offer', category, sort: 'latest'|'urgent', page, pageSize }
 */
export async function feedWall({ kind = 'all', category, sort = 'latest', page = 1, pageSize = 50 } = {}) {
  const tasks = [];
  const catFilter = category ? new RegExp(category, 'i') : null;

  // 收集需求
  if (kind === 'all' || kind === 'need') {
    const helpFilter = { status: { $nin: ['done', 'archived', 'abnormal'] } };
    if (catFilter) helpFilter['content.needs'] = { $in: [catFilter] }; // 简化:匹配需求关键词
    tasks.push(
      Help.find(helpFilter).sort({ submittedAt: -1 }).limit(pageSize * 2).lean().exec()
        .then((arr) => arr.map((h) => ({
          _kind: 'need',
          code: h.code,
          type: 'need',
          category: (h.content?.needs || []).join('/') || '求助',
          title: h.content?.summary || h.content?.rawText || '',
          urgency: h.urgency,
          location: h.location?.address || h.location?.raw || '',
          coordinates: h.location?.coordinates || [],
          phone: h.person?.phone || '',
          name: h.person?.name || '',
          specialPersons: h.person?.specialPersons || [],
          headcount: h.person?.headcount || 1,
          resolved: h.resolved,
          status: h.status,
          createdAt: h.submittedAt,
        })))
    );
  }

  // 收集供给
  if (kind === 'all' || kind === 'offer') {
    const offerFilter = { status: { $in: ['available', 'matched'] } };
    if (catFilter) offerFilter.$or = [{ category: catFilter }, { title: catFilter }];
    tasks.push(
      Offer.find(offerFilter).sort({ submittedAt: -1 }).limit(pageSize * 2).lean().exec()
        .then((arr) => arr.map((o) => ({
          _kind: 'offer',
          code: o.code,
          type: o.type,
          category: o.category,
          title: o.title,
          description: o.description,
          quantity: o.quantity,
          unit: o.unit,
          location: o.location,
          coordinates: o.coordinates || [],
          phone: o.provider?.phone || '',
          name: o.provider?.name || '',
          org: o.provider?.org || '',
          canDeliver: o.canDeliver,
          validUntil: o.validUntil,
          status: o.status,
          createdAt: o.submittedAt,
        })))
    );
  }

  const groups = await Promise.all(tasks);
  let merged = groups.flat();

  // 批量查询需求项的认领信息(让需求方看到谁来帮、怎么联系)
  const needCodes = merged.filter(it => it._kind === 'need').map(it => it.code);
  if (needCodes.length) {
    const matches = await Match.find({
      helpCode: { $in: needCodes },
      status: { $in: ['requested', 'accepted', 'in_transit', 'delivered'] },
    }).lean().exec();
    const matchMap = {}; // helpCode -> [matches]
    for (const m of matches) {
      if (!matchMap[m.helpCode]) matchMap[m.helpCode] = [];
      matchMap[m.helpCode].push({
        code: m.code, status: m.status,
        fulfillerName: m.fulfillerName, fulfillerPhone: m.fulfillerPhone, fulfillerOrg: m.fulfillerOrg,
        note: m.note,
      });
    }
    merged = merged.map(it => it._kind === 'need' ? { ...it, claims: matchMap[it.code] || [] } : it);
  }

  // 排序
  if (sort === 'urgent') {
    const w = URGENCY_WEIGHT;
    merged.sort((a, b) => {
      // 已脱险/fulfilled 靠后
      if (!!a.resolved !== !!b.resolved) return a.resolved ? 1 : -1;
      // 求助按紧急度
      if (a._kind === 'need' && b._kind === 'need') {
        return (w[b.urgency] || 0) - (w[a.urgency] || 0);
      }
      // 求助总体优先于供给
      if (a._kind !== b._kind) return a._kind === 'need' ? -1 : 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  } else {
    merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  const total = merged.length;
  const start = (page - 1) * pageSize;
  return { items: merged.slice(start, start + pageSize), total, page, pageSize };
}

// ===== 供需匹配:为某条需求找候选供给 =====
export async function matchOffersForHelp(helpCode, { limit = 10 } = {}) {
  const help = await Help.findOne({ code: helpCode }).lean().exec();
  if (!help) return { help: null, matches: [] };

  const needs = (help.content?.needs || []).map((n) => new RegExp(n, 'i'));
  // 按需求关键词匹配供给的 category/title
  const filter = { status: 'available' };
  if (needs.length) filter.$or = [{ category: { $in: needs } }, { title: { $in: needs } }];

  const offers = await Offer.find(filter).limit(limit).lean().exec();
  return {
    help: { code: help.code, summary: help.content?.summary, urgency: help.urgency, location: help.location?.address },
    matches: offers.map((o) => ({
      code: o.code, type: o.type, category: o.category, title: o.title,
      quantity: o.quantity, unit: o.unit, location: o.location,
      name: o.provider?.name, org: o.provider?.org, canDeliver: o.canDeliver,
    })),
  };
}
