/**
 * 求助登记服务 —— 群众端提交 → AI 结构化 → 地址标准化 → 入库 → 留痕。
 *
 * 降级原则贯穿全程:AI/地图失败都先存原文,绝不阻塞登记。
 */
import { Help } from '../models/Help.js';
import { genId } from './idService.js';
import { appendAudit } from './auditService.js';
import { extractAndScore } from './aiService.js';
import { reverseGeocode } from './geoService.js';
import { computeSlaDeadline } from './slaService.js';
import { getForm, validateFormData } from './formService.js';
import { detectDuplicate } from './duplicateService.js';
import {
  ID_PREFIX,
  Urgency,
  RegistrationMethod,
  AuditAction,
} from '@rescueflow/shared';

/**
 * 创建一条求助。
 * @param {object} input 见下方字段
 * @returns {Promise<Help>}
 *
 * input:
 *   rawText        群众原始文本(语音转写/手填),二者至少一个
 *   method         voice | manual | image
 *   reporterRelation self | other
 *   person         { name, phone, specialPersons[], headcount }
 *   location       { lng, lat, raw } 经纬度(可空)+ 原始地址
 *   attachments    [code/url...]
 *   consent        boolean
 *   submittedAt    Date(断网补传时为群众真实提交时间)
 *   source         h5 | miniprogram
 *   actorId        提交人(openid/userId)
 */
export async function createHelp(input) {
  const {
    rawText = '',
    transcript = '',
    method = RegistrationMethod.MANUAL,
    reporterRelation = 'self',
    person = {},
    location = {},
    attachments = [],
    consent = false,
    submittedAt = new Date(),
    source = 'h5',
    actorId = '',
    formId = null,
    formData = null,
  } = input;

  if (!consent) {
    const err = new Error('必须勾选同意条款');
    err.status = 400;
    throw err;
  }
  const text = (transcript || rawText || '').trim();
  if (!text && attachments.length === 0) {
    const err = new Error('需提供文字描述或附件');
    err.status = 400;
    throw err;
  }
  if (!person.phone) {
    const err = new Error('联系方式必填');
    err.status = 400;
    throw err;
  }

  // 1. AI 结构化 + 紧急度建议(降级安全)
  const ai = await extractAndScore(text);

  // 1b. 多灾种表单校验(Ushahidi 借鉴):若指定 formId,校验 formData 必填项
  let form = null;
  if (formId) {
    form = await getForm(formId);
    if (!form) {
      const e = new Error(`表单不存在: ${formId}`);
      e.status = 400;
      throw e;
    }
    const { ok: formOk, missing } = validateFormData(form, formData || {});
    if (!formOk) {
      const e = new Error(`表单必填项缺失: ${missing.map((m) => m.label).join(', ')}`);
      e.status = 400;
      e.missing = missing;
      throw e;
    }
  }

  // 2. 地址标准化(降级安全)
  let stdLoc = null;
  if (location.lng != null && location.lat != null) {
    stdLoc = await reverseGeocode(Number(location.lng), Number(location.lat));
  }

  // 3. 生成编号
  const code = await genId(ID_PREFIX.HELP, { region: 'GX' });

  // 4. 紧急度:AI 建议 + 特殊人员加权(有特殊人员至少 medium)
  let urgency = ai.urgency || Urgency.MEDIUM;
  const hasSpecial = Array.isArray(person.specialPersons) && person.specialPersons.length > 0;
  if (hasSpecial && urgency === Urgency.LOW) urgency = Urgency.MEDIUM;

  // 5. SLA 截止
  const slaDeadline = computeSlaDeadline(urgency, submittedAt);

  const doc = await Help.create({
    code,
    eventId: null,
    formId: form ? form.slug : null,
    formData: formData || null,
    status: 'pending',
    urgency,
    credibility: 2,
    method,
    reporterRelation,
    source,
    submittedAt,
    person: {
      name: person.name || '',
      phone: person.phone,
      specialPersons: person.specialPersons || [],
      headcount: person.headcount || 1,
      contactPreference: person.contactPreference || 'public',
    },
    content: {
      rawText: text,
      summary: ai.summary,
      needs: ai.needs,
    },
    location: {
      coordinates: location.lng != null ? [Number(location.lng), Number(location.lat)] : [],
      address: stdLoc?.address || location.raw || '',
      province: stdLoc?.province || '',
      city: stdLoc?.city || '',
      district: stdLoc?.district || '',
      raw: location.raw || '',
      accuracy: location.accuracy ?? null,
    },
    ai: {
      transcript: transcript || '',
      structured: ai.structured || null,
      urgencySuggestion: ai.urgency || null,
      duplicateOf: null,
      duplicateScore: null,
      processedAt: ai.degraded ? null : new Date(),
      degraded: ai.degraded,
    },
    attachments,
    slaDeadline,
    slaBreached: false,
    consent: true,
    privacyVersion: 'v0.1',
    hasSpecialPerson: hasSpecial,
    createdBy: actorId,
  });

  // 6. 重复检测(救命文档最痛问题):只提示不拦截,写入 ai.duplicateOf
  try {
    const dup = await detectDuplicate({
      text,
      phone: person.phone,
      lng: location.lng != null ? Number(location.lng) : null,
      lat: location.lat != null ? Number(location.lat) : null,
      submittedAt,
    });
    if (dup.suspicious) {
      const best = dup.matches[0];
      doc.ai.duplicateOf = best.code;
      doc.ai.duplicateScore = best.score;
      await doc.save();
    }
  } catch (e) {
    console.warn('[dup] 重复检测失败,降级跳过:', e.message);
  }

  // 7. 留痕:登记
  await appendAudit({
    entityType: 'help',
    entityId: code,
    action: AuditAction.CREATE,
    actorId,
    summary: `登记求助(${method}),紧急度建议 ${ai.urgency || 'N/A'}` + (doc.ai.duplicateOf ? `,疑似重复 ${doc.ai.duplicateOf}` : ''),
    toStatus: 'pending',
  });

  return doc;
}

/**
 * 列表查询(管理后台用,阶段2会加权限/筛选)。
 * 按紧急度权重 + 特殊人员 + 提交时间排序。
 */
export async function listHelps({ status, urgency, q, page = 1, pageSize = 20 } = {}) {
  const filter = { deletedAt: null };
  if (status) filter.status = status;
  if (urgency) filter.urgency = urgency;
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { code: rx },
      { 'person.name': rx },
      { 'person.phone': rx },
      { 'content.summary': rx },
      { 'content.rawText': rx },
      { 'location.address': rx },
      { 'location.raw': rx },
    ];
  }

  const weight = { critical: 4, high: 3, medium: 2, low: 1 };
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    Help.find(filter)
      .sort({ slaBreached: -1, urgency: -1, hasSpecialPerson: -1, submittedAt: 1 })
      .skip(skip)
      .limit(pageSize)
      .lean()
      .exec()
      .then((arr) =>
        arr.map((d) => ({ ...d, _urgencyWeight: weight[d.urgency] || 0 }))
      ),
    Help.countDocuments(filter).exec(),
  ]);

  return { items, total, page, pageSize };
}

export async function getHelp(code) {
  return Help.findOne({ code }).lean().exec();
}
