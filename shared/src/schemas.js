/**
 * 数据结构契约(JS 表达)——三端共享字段定义。
 *
 * 注意:这是字段【契约与默认值】的描述,不是 Mongoose schema。
 * server/models/ 里基于这些契约实现 Mongoose 模型;前端基于它们生成表单与类型。
 *
 * 设计依据:V0.1 第4/5/7/8 节 + 补充(断网/留痕哈希链/特殊人员排序/SLA)。
 */

// 通用:坐标点
export const locationShape = {
  type: 'Point', // GeoJSON
  coordinates: [], // [lng, lat]
  address: '', // 标准化地址(逆解析后)
  province: '',
  city: '',
  district: '',
  raw: '', // 群众原始输入
  accuracy: null, // 定位精度(米)
  mapProvider: 'tencent',
  confidence: null, // 地址标准化可信度 0~1
};

// 事件(聚合容器:一次洪涝/震情)INC-
export const eventFields = {
  code: '', // INC-GX-2026-000001
  name: '', // 如 "2026 广西洪涝"
  region: 'GX',
  status: 'active', // active | closed
  description: '',
  center: { ...locationShape }, // 事件中心点
  startedAt: null, // Date
  closedAt: null,
  // 统计(派生)
  stats: {
    total: 0,
    pending: 0,
    verified: 0,
    done: 0,
  },
};

// 求助(核心实体)HELP- —— 对应 V0.1 生命周期
export const helpFields = {
  code: '', // HELP-GX-2026-000001
  eventId: null, // 所属事件 INC 编号(可空,后续关联)

  // 状态
  status: 'pending',
  abnormalReason: null, // status=abnormal 时必填
  urgency: 'medium',
  credibility: 2, // 1~5,对应第6节五级

  // 登记元信息
  method: 'manual', // voice | manual | image
  reporterRelation: 'self', // self | other
  source: 'h5', // h5 | miniprogram | batch
  createdAt: null, // Date
  createdBy: null, // userId / openid
  submittedAt: null, // 实际提交时间(断网补传时 ≠ createdAt)

  // 求助人
  person: {
    name: '', // 可选(最小必要)
    phone: '', // 必填,默认脱敏存储/展示
    specialPersons: [], // [SpecialPerson...] 特殊人员标记,影响排序
    headcount: 1, // 受困人数
  },

  // 求助内容
  content: {
    rawText: '', // 群众原始文本(语音转写或手填)
    summary: '', // AI/人工提炼的摘要
    needs: [], // 需求类型(求救/物资/转移/医疗...),V1 自由文本兜底
  },

  // 位置
  location: { ...locationShape },

  // AI 处理结果(AI 仅辅助,人工可覆盖)
  ai: {
    transcript: '', // 语音转文字
    structured: null, // 结构化提取结果
    urgencySuggestion: null, // 建议紧急度(供人工确认)
    duplicateOf: null, // 疑似重复指向的 HELP 编号(仅提示)
    duplicateScore: null, // 重复相似度 0~1
    processedAt: null,
    degraded: false, // 是否降级(AI/地图失败时先存原文)
  },

  // 附件
  attachments: [], // [attachmentCode...] 引用 attachments 集合

  // 核实/转交
  verifiedBy: null,
  verifiedAt: null,
  transferredTo: '', // 转交去向(救援队/志愿者/其他平台)
  transferredAt: null,

  // SLA
  slaDeadline: null, // 根据紧急度计算的截止时间
  slaBreached: false,

  // 合规
  consent: false, // 是否勾选同意
  privacyVersion: '', // 隐私协议版本
};

// 附件(语音/图片)——独立集合以便复用与留痕
export const attachmentFields = {
  code: '', // 内部引用编号(可选)
  type: 'image', // voice | image | video
  url: '', // 对象存储 / 本地路径
  size: 0,
  mimeType: '',
  duration: null, // 语音时长(秒)
  sha256: '', // 完整性校验
  uploadedBy: null,
  uploadedAt: null,
};

// 留痕(append-only + 哈希链)——支撑"全程留痕"可验证性
export const auditLogFields = {
  // 哈希链: prevHash = SHA256(prevEntry 的 hash 草稿字段)
  //   即每条记录的 hash = SHA256(prevHash + canonicalJSON(本条除 hash 外字段))
  //   链上任意一环被篡改,后续 hash 全部对不上。
  seq: 0, // 同 entityType+entityId 内单调递增
  prevHash: '0'.repeat(64), // 创世条目为 64 个 0
  hash: '', // 本条哈希

  entityType: 'help', // help | event | user | ...
  entityId: '', // 关联业务编号

  action: '', // AuditAction
  fromStatus: null, // 流转动作的源状态
  toStatus: null, // 流转动作的目标状态

  actorId: '', // 操作人 userId/openid
  actorRole: '', // 操作时角色
  summary: '', // 人类可读摘要

  // 变更快照(可选,敏感字段变更前后)
  changes: null,

  createdAt: null, // Date
  ip: '',
  userAgent: '',
};
