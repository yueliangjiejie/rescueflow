/**
 * 组织(承接方)服务。
 */
import { Organization, BUILTIN_ORGS } from '../models/Organization.js';
import { genId } from './idService.js';

export async function ensureBuiltinOrgs() {
  for (const o of BUILTIN_ORGS) {
    const exists = await Organization.findOne({ name: o.name });
    if (!exists) {
      const code = 'ORG-GX-2026-' + String(Date.now()).slice(-6);
      await Organization.create({ ...o, code, verified: true });
    }
  }
}

export async function listOrgs({ type, activeOnly } = {}) {
  const filter = {};
  if (type) filter.type = type;
  if (activeOnly) filter.active = true;
  return Organization.find(filter).sort({ verified: -1, name: 1 }).lean().exec();
}

export async function createOrg(input) {
  const code = 'ORG-GX-2026-' + String(Date.now()).slice(-6);
  return Organization.create({
    code,
    name: input.name,
    type: input.type || 'rescue_team',
    contactName: input.contactName || '',
    contactPhone: input.contactPhone || '',
    contactWechat: input.contactWechat || '',
    address: input.address || '',
    coordinates: input.coordinates || [],
    capabilities: input.capabilities || [],
    serviceArea: input.serviceArea || '',
    note: input.note || '',
  });
}

export async function updateOrg(id, patch) {
  return Organization.findByIdAndUpdate(id, patch, { new: true }).lean().exec();
}

export async function deleteOrg(id) {
  return Organization.findByIdAndUpdate(id, { active: false }, { new: true }).lean().exec();
}
