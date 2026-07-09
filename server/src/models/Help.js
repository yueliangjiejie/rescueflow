/**
 * 求助模型 —— 核心实体 HELP-{REGION}-{YEAR}-{seq}
 *
 * 设计来源:V0.1 第4/5/7/8 节 + 补充(特殊人员标记影响排序、SLA、AI 降级、断网补传)。
 * 状态机守卫见 shared/enums.js HELP_TRANSITIONS。
 */
import mongoose from 'mongoose';

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, default: 'Point', enum: ['Point'] },
    coordinates: { type: [Number], default: [] }, // [lng, lat]
    address: { type: String, default: '' },
    province: { type: String, default: '' },
    city: { type: String, default: '' },
    district: { type: String, default: '' },
    raw: { type: String, default: '' },
    accuracy: { type: Number, default: null },
    mapProvider: { type: String, default: 'tencent' },
    confidence: { type: Number, default: null },
  },
  { _id: false }
);

const contentSchema = new mongoose.Schema(
  {
    rawText: { type: String, default: '' },
    summary: { type: String, default: '' },
    needs: { type: [String], default: [] },
  },
  { _id: false }
);

const aiSchema = new mongoose.Schema(
  {
    transcript: { type: String, default: '' },
    structured: { type: mongoose.Schema.Types.Mixed, default: null },
    urgencySuggestion: { type: String, default: null },
    duplicateOf: { type: String, default: null }, // 疑似重复的 HELP 编号(仅提示)
    duplicateScore: { type: Number, default: null },
    processedAt: { type: Date, default: null },
    degraded: { type: Boolean, default: false }, // AI/地图失败时降级
  },
  { _id: false }
);

const helpSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    eventId: { type: String, default: null, index: true }, // 关联 INC 编号
    formId: { type: String, default: null, index: true }, // 关联 Form slug(多灾种,Ushahidi 借鉴)
    formData: { type: mongoose.Schema.Types.Mixed, default: null }, // 自定义表单字段值

    // 状态
    status: {
      type: String,
      enum: ['pending', 'verified', 'transferred', 'in_progress', 'done', 'archived', 'abnormal'],
      default: 'pending',
      index: true,
    },
    abnormalReason: {
      type: String,
      enum: ['duplicate', 'false', 'out_of_scope', 'spam', null],
      default: null,
    },
    urgency: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium',
      index: true,
    },
    credibility: { type: Number, min: 1, max: 5, default: 2 },

    // 登记元信息
    method: { type: String, enum: ['voice', 'manual', 'image'], default: 'manual' },
    reporterRelation: { type: String, enum: ['self', 'other'], default: 'self' },
    source: { type: String, default: 'h5' },
    submittedAt: { type: Date, default: Date.now }, // 群众实际提交(断网补传时 ≠ createdAt)
    createdBy: { type: String, default: '' }, // 提交人 openid/userId

    // 求助人
    person: {
      name: { type: String, default: '', trim: true },
      phone: { type: String, default: '', trim: true }, // 展示前由脱敏中间件处理
      specialPersons: { type: [String], default: [] }, // SpecialPerson[]
      headcount: { type: Number, default: 1, min: 1 },
      // 联系方式可见性(借鉴 DRAP,比单纯脱敏更尊重用户)
      // public=志愿者可见(脱敏) | verified_only=仅核实后可见 | private=不公开
      contactPreference: { type: String, enum: ['public', 'verified_only', 'private'], default: 'public' },
    },

    // 求助内容
    content: { type: contentSchema, default: () => ({}) },

    // 位置
    location: { type: pointSchema, default: () => ({}) },

    // AI 处理结果
    ai: { type: aiSchema, default: () => ({}) },

    // 附件引用(attachment 编号或 _id)
    attachments: { type: [String], default: [] },

    // 核实/转交
    verifiedBy: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
    transferredTo: { type: String, default: '' },
    transferredAt: { type: Date, default: null },
    // 指派核实人(管理:谁来核)
    assignedVerifier: { type: String, default: null, index: true },
    assignedAt: { type: Date, default: null },
    // 软删除(灾情数据不真删,可恢复)
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: String, default: '' },
    // 转移链路(洪涝场景:车/船转移全过程跟踪)
    transferVehicle: { type: String, default: '' }, // boat/car/helicopter/other
    transferDepartedAt: { type: Date, default: null },
    transferArrivedAt: { type: Date, default: null },
    transferPassengers: { type: Number, default: 0 },

    // 认领机制(借鉴"救命文档":支持多名志愿者并行核实)
    // 一个求助可被一名志愿者认领(负责核实),避免重复劳动
    claimedBy: { type: String, default: null, index: true },
    claimedAt: { type: Date, default: null },

    // 核实详情(Ushahidi 借鉴:核实是流程,记录 who/when/how)
    verification: {
      method: { type: String, default: '', enum: ['', 'phone', 'sms', 'wechat', 'onsite', 'other'] }, // 怎么核实的
      note: { type: String, default: '' }, // 核实备注
    },

    // 成果量化(借鉴 DRAP TaskProgress:完成后的处置成果)
    outcome: {
      rescued: { type: Number, default: 0 }, // 已转移/救出人数
      treated: { type: Number, default: 0 }, // 已救治人数
      missing: { type: Number, default: 0 }, // 失联人数
      note: { type: String, default: '' },
    },
    // "是否脱险"——救命文档里最关键的命脉字段
    resolved: { type: Boolean, default: false },

    // SLA(根据紧急度计算,见 services/sla.js)
    slaDeadline: { type: Date, default: null, index: true },
    slaBreached: { type: Boolean, default: false },

    // 合规
    consent: { type: Boolean, default: false },
    privacyVersion: { type: String, default: 'v0.1' },

    // 排序辅助:特殊人员是否有标记(便于列表加权)
    hasSpecialPerson: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, collection: 'helps' }
);

// 地理索引(重复检测 + V2 地图)
helpSchema.index({ 'location.coordinates': '2dsphere' });

// 复合索引:列表查询主力(状态 + 紧急度 + 提交时间)
helpSchema.index({ status: 1, urgency: -1, submittedAt: 1 });

// 落库前同步派生字段
helpSchema.pre('validate', function (next) {
  if (this.person && Array.isArray(this.person.specialPersons)) {
    this.hasSpecialPerson = this.person.specialPersons.length > 0;
  }
  next();
});

export const Help = mongoose.model('Help', helpSchema);
