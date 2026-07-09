/**
 * 认领/对接模型 —— 把信息墙从"看板"变成"真实流转工具"。
 *
 * 一条 Match = 一次供需对接承诺:
 *   供给方/志愿者 认领 了 某条需求(Help),或 提供给 某需求方。
 *
 * 状态流转(双方承诺制):
 *   requested(发起对接)
 *     → accepted(对方接受,对接中)
 *       → in_transit(配送中,物资/人员上路)
 *         → delivered(已送达/已到场)
 *           → completed(已确认完成)
 *   任一状态可 → cancelled(取消)
 *
 * 全程留痕:每个状态变更写 audit。超时未响应自动标记(避免石沉大海)。
 */
import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true }, // MATCH-...

    // 关联实体:一条需求(Help)+ 可选一条供给(Offer)
    helpCode: { type: String, required: true, index: true },
    offerCode: { type: String, default: null, index: true },

    // 双方
    requesterId: { type: String, default: '' }, // 需求方/发起人
    fulfillerId: { type: String, default: '' }, // 认领/供给方
    // 认领人联系方式(必填,这是"对接"能落地的关键——需求方要知道谁来帮、怎么联系)
    fulfillerName: { type: String, default: '' },
    fulfillerPhone: { type: String, default: '' },
    fulfillerOrg: { type: String, default: '' }, // 所属组织(可选,如蓝天救援队)

    // 状态机
    status: {
      type: String,
      enum: ['requested', 'accepted', 'in_transit', 'delivered', 'completed', 'cancelled'],
      default: 'requested',
      index: true,
    },

    // 对接详情
    quantity: { type: Number, default: null }, // 实际对接数量
    note: { type: String, default: '' }, // 对接备注(谁联系谁、约几点)
    estimatedArrival: { type: Date, default: null }, // 预计到达/完成时间

    // 关键时间点(留痕用)
    requestedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    // 超时
    respondDeadline: { type: Date, default: null }, // 要求响应截止时间
    isOverdue: { type: Boolean, default: false },

    eventId: { type: String, default: null },
  },
  { timestamps: true, collection: 'matches' }
);

matchSchema.index({ helpCode: 1, status: 1 });
matchSchema.index({ fulfillerId: 1, status: 1 });

export const Match = mongoose.model('Match', matchSchema);

export const MATCH_TRANSITIONS = {
  requested: ['accepted', 'cancelled'],
  accepted: ['in_transit', 'delivered', 'completed', 'cancelled'],
  in_transit: ['delivered', 'completed', 'cancelled'],
  delivered: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const MATCH_STATUS_LABELS = {
  requested: '待响应', accepted: '已接受', in_transit: '配送中',
  delivered: '已送达', completed: '已完成', cancelled: '已取消',
};
