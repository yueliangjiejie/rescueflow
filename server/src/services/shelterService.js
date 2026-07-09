/**
 * 避难所/灾民/物资服务 —— 移植 DRAP 核心灾时能力。
 *
 * 含:避难所 CRUD(容量自动管理)、灾民登记/查询(寻亲)、
 *     物资流水(调拨/消耗/捐赠)、库存汇总。
 */
import { Shelter } from '../models/Shelter.js';
import { Inmate } from '../models/Inmate.js';
import { ResourceFlow } from '../models/ResourceFlow.js';
import { ResourceType, BUILTIN_RESOURCE_TYPES } from '../models/ResourceType.js';
import { genId } from './idService.js';
import { ID_PREFIX } from '@rescueflow/shared';

/** 初始化内置物资类型字典。 */
export async function ensureBuiltinResourceTypes() {
  for (const r of BUILTIN_RESOURCE_TYPES) {
    await ResourceType.updateOne({ name: r.name }, { $setOnInsert: { ...r, builtin: true } }, { upsert: true }).exec();
  }
}

// ===== 避难所 =====

export async function createShelter(input) {
  const code = await genId(ID_PREFIX.SHELTER, { region: 'GX' });
  const shelter = await Shelter.create({
    code,
    name: input.name || '',
    location: input.location || '',
    coordinates: input.coordinates || [],
    totalCapacity: input.totalCapacity || 0,
    contactDetails: input.contactDetails || '',
    assignedVolunteer: input.assignedVolunteer || null,
    eventId: input.eventId || null,
  });
  return shelter;
}

export async function listShelters({ eventId, availableOnly } = {}) {
  const filter = { active: true };
  if (eventId) filter.eventId = eventId;
  if (availableOnly) filter.available = true;
  return Shelter.find(filter).sort({ createdAt: -1 }).lean().exec();
}

export async function getShelter(id) {
  return Shelter.findById(id).lean().exec();
}

// ===== 灾民登记(含寻亲)=====

export async function checkInInmate(input) {
  const inmate = await Inmate.create({
    name: input.name,
    place: input.place || '',
    age: input.age || 0,
    contact: input.contact || '',
    shelterId: input.shelterId,
    eventId: input.eventId || null,
    specialPersons: input.specialPersons || [],
    status: 'in',
  });
  // 避难所人数 +1(触发 pre-save 自动重算 available)
  const shelter = await Shelter.findById(input.shelterId);
  if (shelter) {
    shelter.inmates = (shelter.inmates || 0) + 1;
    await shelter.save();
  }
  return inmate;
}

export async function checkOutInmate(id) {
  const inmate = await Inmate.findByIdAndUpdate(id, { status: 'out', checkedOutAt: new Date() }, { new: true }).exec();
  if (inmate) {
    const shelter = await Shelter.findById(inmate.shelterId);
    if (shelter && shelter.inmates > 0) {
      shelter.inmates -= 1;
      await shelter.save();
    }
  }
  return inmate;
}

/** 寻亲:按姓名/联系方式查询已登记灾民。 */
export async function searchInmates({ name, contact, shelterId, eventId } = {}) {
  const filter = {};
  if (name) filter.name = new RegExp(name, 'i');
  if (contact) filter.contact = contact;
  if (shelterId) filter.shelterId = shelterId;
  if (eventId) filter.eventId = eventId;
  return Inmate.find(filter).sort({ checkedInAt: -1 }).limit(100).lean().exec();
}

// ===== 物资流水 + 库存汇总 =====

export async function addResourceFlow(input) {
  return ResourceFlow.create({
    shelterId: input.shelterId,
    type: input.type, // allocate / consume / donate
    resources: input.resources || [],
    operatorId: input.operatorId || '',
    operatorName: input.operatorName || '',
    fromParty: input.fromParty || '',
    note: input.note || '',
    eventId: input.eventId || null,
  });
}

/**
 * 库存汇总:某避难所(或全部)的物资净库存。
 * 净库存 = 调拨入 + 捐赠入 - 消耗。
 */
export async function inventorySummary({ shelterId, eventId } = {}) {
  const match = {};
  if (shelterId) match.shelterId = shelterId;
  if (eventId) match.eventId = eventId;

  const flows = await ResourceFlow.find(match).lean().exec();
  const stock = {}; // { '饮用水': { qty, unit } }
  for (const f of flows) {
    const sign = f.type === 'consume' ? -1 : 1;
    for (const r of f.resources || []) {
      if (!stock[r.resourceType]) stock[r.resourceType] = { qty: 0, unit: r.unit };
      stock[r.resourceType].qty += sign * (r.quantity || 0);
      if (r.unit) stock[r.resourceType].unit = r.unit;
    }
  }
  // 转数组,过滤负数告警
  return Object.entries(stock)
    .map(([name, v]) => ({ name, quantity: v.qty, unit: v.unit, low: v.qty < 0 }))
    .sort((a, b) => b.quantity - a.quantity);
}

export async function listResourceTypes() {
  return ResourceType.find().sort({ category: 1, name: 1 }).lean().exec();
}
