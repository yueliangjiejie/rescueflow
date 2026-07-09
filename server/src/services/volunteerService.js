/**
 * 志愿者服务 —— 申请、审批、按技能/位置匹配(借鉴 DRAP 核心能力)。
 *
 * 匹配维度:
 *   1. 技能(必须命中求助 needs 或指定 skill)
 *   2. 可用性(available + taskStatus=0)
 *   3. 就近(serviceArea 距离,V2 接入地图后用)
 */
import { Volunteer } from '../models/Volunteer.js';
import { Skill, BUILTIN_SKILLS } from '../models/Skill.js';

/** 初始化内置技能字典(幂等)。 */
export async function ensureBuiltinSkills() {
  for (const s of BUILTIN_SKILLS) {
    await Skill.updateOne({ name: s.name }, { $setOnInsert: { ...s, builtin: true } }, { upsert: true }).exec();
  }
}

/** 提交志愿者申请(需已注册 User)。 */
export async function applyVolunteer(userId, { skills = [], idProof = '', experienceCertificate = '', serviceArea = {} }) {
  const existing = await Volunteer.findOne({ userId }).exec();
  if (existing) {
    // 更新申请
    if (skills.length) existing.skills = skills;
    if (idProof) existing.idProof = idProof;
    if (experienceCertificate) existing.experienceCertificate = experienceCertificate;
    if (serviceArea) existing.serviceArea = { ...existing.serviceArea, ...serviceArea };
    existing.applicationStatus = 0; // 重新审核
    await existing.save();
    return existing;
  }
  return Volunteer.create({ userId, skills, idProof, experienceCertificate, serviceArea, applicationStatus: 0 });
}

/** 管理员审批。status: 1=通过 2=拒绝 */
export async function reviewVolunteer(volunteerId, status, opts = {}) {
  const v = await Volunteer.findById(volunteerId).exec();
  if (!v) throw Object.assign(new Error('志愿者不存在'), { status: 404 });
  v.applicationStatus = status;
  await v.save();
  return v;
}

/**
 * 按技能匹配空闲志愿者(DRAP 亮点功能)。
 * @param {object} opts { skill, needs[], limit }
 */
export async function matchVolunteers({ skill, needs = [], limit = 20 } = {}) {
  const skillsQ = skill ? [skill] : needs;
  const filter = { available: true, taskStatus: 0, applicationStatus: 1 };
  if (skillsQ && skillsQ.length) filter.skills = { $in: skillsQ };
  return Volunteer.find(filter).limit(limit).lean().exec();
}
