/**
 * RescueFlow 枚举(状态机、类型、等级)
 * 状态流转图见 V0.1 第8节,异常分支见补充设计(第10节细化)
 */

// ============ 求助状态机 ============
// 主线: PENDING -> VERIFIED -> TRANSFERRED -> IN_PROGRESS -> DONE -> ARCHIVED
// 异常: 任意态可转 ABNORMAL(细分 reason)
export const HelpStatus = Object.freeze({
  PENDING: 'pending', // 待核实
  VERIFIED: 'verified', // 已核实
  TRANSFERRED: 'transferred', // 已转交(派单)
  IN_PROGRESS: 'in_progress', // 处理中
  DONE: 'done', // 已完成
  ARCHIVED: 'archived', // 归档
  ABNORMAL: 'abnormal', // 异常(细分见 HelpAbnormalReason)
});

// 允许的状态流转(状态机守卫)
export const HELP_TRANSITIONS = Object.freeze({
  [HelpStatus.PENDING]: [HelpStatus.VERIFIED, HelpStatus.ABNORMAL, HelpStatus.ARCHIVED],
  [HelpStatus.VERIFIED]: [HelpStatus.TRANSFERRED, HelpStatus.DONE, HelpStatus.ABNORMAL, HelpStatus.ARCHIVED],
  [HelpStatus.TRANSFERRED]: [HelpStatus.IN_PROGRESS, HelpStatus.DONE, HelpStatus.ABNORMAL, HelpStatus.ARCHIVED],
  [HelpStatus.IN_PROGRESS]: [HelpStatus.DONE, HelpStatus.ABNORMAL, HelpStatus.ARCHIVED],
  [HelpStatus.DONE]: [HelpStatus.ARCHIVED],
  [HelpStatus.ABNORMAL]: [HelpStatus.PENDING, HelpStatus.ARCHIVED],
  [HelpStatus.ARCHIVED]: [],
});

// 异常信息四分类(补充设计:原"异常信息"细化)
export const HelpAbnormalReason = Object.freeze({
  DUPLICATE: 'duplicate', // 重复
  FALSE: 'false', // 不实
  OUT_OF_SCOPE: 'out_of_scope', // 超出能力范围
  SPAM: 'spam', // 测试/垃圾
});

export const HELP_ABNORMAL_LABELS = Object.freeze({
  [HelpAbnormalReason.DUPLICATE]: '重复信息',
  [HelpAbnormalReason.FALSE]: '信息不实',
  [HelpAbnormalReason.OUT_OF_SCOPE]: '超出范围',
  [HelpAbnormalReason.SPAM]: '测试/垃圾',
});

// ============ 紧急程度(影响排序 + SLA)============
export const Urgency = Object.freeze({
  CRITICAL: 'critical', // 红:危及生命
  HIGH: 'high', // 橙:紧迫
  MEDIUM: 'medium', // 黄:一般
  LOW: 'low', // 蓝:信息报备
});

export const URGENCY_LABELS = Object.freeze({
  [Urgency.CRITICAL]: '紧急',
  [Urgency.HIGH]: '紧迫',
  [Urgency.MEDIUM]: '一般',
  [Urgency.LOW]: '报备',
});

// 紧急度排序权重(越大越靠前),配合 SLA 用于列表排序
export const URGENCY_WEIGHT = Object.freeze({
  [Urgency.CRITICAL]: 4,
  [Urgency.HIGH]: 3,
  [Urgency.MEDIUM]: 2,
  [Urgency.LOW]: 1,
});

// ============ 特殊人员标记(直接影响排序权重)============
// 来自 V0.1 第4节 MVP 群众端"特殊人员标记"
export const SpecialPerson = Object.freeze({
  ELDERLY: 'elderly', // 老人
  CHILD: 'child', // 儿童
  PREGNANT: 'pregnant', // 孕妇
  DISABLED: 'disabled', // 残疾/行动不便
  PATIENT: 'patient', // 急病/受伤
  ISOLATED: 'isolated', // 失联/独居
});

export const SPECIAL_PERSON_LABELS = Object.freeze({
  [SpecialPerson.ELDERLY]: '老人',
  [SpecialPerson.CHILD]: '儿童',
  [SpecialPerson.PREGNANT]: '孕妇',
  [SpecialPerson.DISABLED]: '残疾/行动不便',
  [SpecialPerson.PATIENT]: '急病/受伤',
  [SpecialPerson.ISOLATED]: '失联/独居',
});

// ============ 登记方式 ============
export const RegistrationMethod = Object.freeze({
  VOICE: 'voice', // 语音登记(推荐)
  MANUAL: 'manual', // 手动填写
  IMAGE: 'image', // 图片识别(后续)
});

// ============ 登记主体 ============
export const ReporterRelation = Object.freeze({
  SELF: 'self', // 本人登记
  OTHER: 'other', // 代他人登记
});

// ============ 附件类型 ============
export const AttachmentType = Object.freeze({
  VOICE: 'voice',
  IMAGE: 'image',
  VIDEO: 'video',
});

// ============ 留痕操作类型 ============
export const AuditAction = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  TRANSITION: 'transition', // 状态流转
  VERIFY: 'verify', // 核实(含可信度评定)
  TRANSFER: 'transfer', // 转交
  EXPORT: 'export', // 导出
  DELETE: 'delete',
  AI_PROCESS: 'ai_process', // AI 处理
  VIEW: 'view', // 查看敏感信息(脱敏字段解码)
});

// ============ 用户角色(RBAC)============
export const Role = Object.freeze({
  PUBLIC: 'public', // 群众(仅登记)
  VOLUNTEER: 'volunteer', // 志愿者(核实/转交)
  OPERATOR: 'operator', // 操作员(全部业务操作 + 导出)
  ADMIN: 'admin', // 管理员(含用户/角色管理 + 删除)
});
