/**
 * 求助状态流转服务 —— 状态机守卫 + 可信度 + 异常分类 + 全程留痕。
 *
 * 状态机见 shared/enums.js HELP_TRANSITIONS。非法流转抛 400。
 * 每次流转都写 audit(transition),可信度/异常也写 verify 记录。
 */
import { Help } from '../models/Help.js';
import { appendAudit } from './auditService.js';
import { computeSlaDeadline } from './slaService.js';
import { HELP_TRANSITIONS, HelpStatus, HelpAbnormalReason, AuditAction, Urgency } from '@rescueflow/shared';

function bad(msg, code = 400) {
  const e = new Error(msg);
  e.status = code;
  return e;
}

/**
 * 通用状态流转。
 * @param {string} code HELP 编号
 * @param {string} toStatus 目标状态
 * @param {object} opts { actorId, actorRole, summary, abnormalReason, credibility, urgency, transferredTo }
 */
export async function transition(code, toStatus, opts = {}) {
  const help = await Help.findOne({ code }).exec();
  if (!help) throw bad('求助不存在', 404);

  const allowed = HELP_TRANSITIONS[help.status] || [];
  if (!allowed.includes(toStatus)) {
    throw bad(`不允许从 ${help.status} 转为 ${toStatus}`);
  }

  const fromStatus = help.status;
  const changes = {};

  help.status = toStatus;
  changes.status = { from: fromStatus, to: toStatus };

  // 异常分支:需带 abnormalReason
  if (toStatus === HelpStatus.ABNORMAL) {
    const reason = opts.abnormalReason;
    if (!Object.values(HelpAbnormalReason).includes(reason)) {
      throw bad('异常需提供有效 abnormalReason');
    }
    help.abnormalReason = reason;
    changes.abnormalReason = reason;
  } else if (help.abnormalReason) {
    // 恢复主线时清空异常原因
    help.abnormalReason = null;
  }

  // 核实(转入 verified):可一并评定可信度
  if (toStatus === HelpStatus.VERIFIED && opts.credibility != null) {
    help.credibility = opts.credibility;
    help.verifiedBy = opts.actorId || null;
    help.verifiedAt = new Date();
    changes.credibility = opts.credibility;
  }

  // 转交
  if (toStatus === HelpStatus.TRANSFERRED && opts.transferredTo) {
    help.transferredTo = opts.transferredTo;
    help.transferredAt = new Date();
    changes.transferredTo = opts.transferredTo;
  }

  // 紧急度可在此修正(人工覆盖 AI 建议)
  if (opts.urgency && Object.values(Urgency).includes(opts.urgency) && opts.urgency !== help.urgency) {
    help.urgency = opts.urgency;
    help.slaDeadline = computeSlaDeadline(opts.urgency, help.submittedAt);
    changes.urgency = opts.urgency;
  }

  await help.save();

  await appendAudit({
    entityType: 'help',
    entityId: code,
    action: AuditAction.TRANSITION,
    fromStatus,
    toStatus,
    actorId: opts.actorId || '',
    actorRole: opts.actorRole || '',
    summary: opts.summary || `${fromStatus} → ${toStatus}`,
    changes,
  });

  return help;
}

// 便捷封装
export const verify = (code, opts) => transition(code, HelpStatus.VERIFIED, opts);
export const transfer = (code, opts) => transition(code, HelpStatus.TRANSFERRED, opts);
export const markAbnormal = (code, opts) => transition(code, HelpStatus.ABNORMAL, opts);
export const archive = (code, opts) => transition(code, HelpStatus.ARCHIVED, opts);

/**
 * 认领求助(借鉴"救命文档":志愿者并行核实,避免重复劳动)。
 * 已被认领则拒绝(除非 force)。
 */
export async function claim(code, opts = {}) {
  const help = await Help.findOne({ code }).exec();
  if (!help) throw bad('求助不存在', 404);
  if (help.claimedBy && help.claimedBy !== opts.actorId && !opts.force) {
    const e = new Error(`已被 ${help.claimedBy} 认领`);
    e.status = 409;
    throw e;
  }
  help.claimedBy = opts.actorId || null;
  help.claimedAt = new Date();
  await help.save();
  await appendAudit({
    entityType: 'help',
    entityId: code,
    action: AuditAction.UPDATE,
    actorId: opts.actorId || '',
    actorRole: opts.actorRole || '',
    summary: '认领求助',
    changes: { claimedBy: help.claimedBy },
  });
  return help;
}

/** 取消认领。 */
export async function unclaim(code, opts = {}) {
  const help = await Help.findOne({ code }).exec();
  if (!help) throw bad('求助不存在', 404);
  help.claimedBy = null;
  help.claimedAt = null;
  await help.save();
  await appendAudit({
    entityType: 'help',
    entityId: code,
    action: AuditAction.UPDATE,
    actorId: opts.actorId || '',
    summary: '取消认领',
  });
  return help;
}

/**
 * 标记脱险 + 录入成果(救命文档命脉字段 + DRAP TaskProgress)。
 * resolved=true 后列表醒目展示。
 */
export async function setResolved(code, resolved, outcome = {}, opts = {}) {
  const help = await Help.findOne({ code }).exec();
  if (!help) throw bad('求助不存在', 404);
  help.resolved = !!resolved;
  if (outcome && typeof outcome === 'object') {
    help.outcome = {
      rescued: Number(outcome.rescued) || 0,
      treated: Number(outcome.treated) || 0,
      missing: Number(outcome.missing) || 0,
      note: outcome.note || '',
    };
  }
  await help.save();
  await appendAudit({
    entityType: 'help',
    entityId: code,
    action: AuditAction.UPDATE,
    actorId: opts.actorId || '',
    actorRole: opts.actorRole || '',
    summary: resolved ? `标记脱险(救出${help.outcome.rescued}人)` : '取消脱险标记',
    changes: { resolved, outcome: help.outcome },
  });
  return help;
}
