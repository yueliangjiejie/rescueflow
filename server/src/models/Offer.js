/**
 * 互助(供给)模型 —— 和 Help(需求)对称。
 *
 * "群策群力":不只是受灾者发需求,有资源的人也能公开"我能帮什么":
 *   - supplies(物资):我有 200 箱矿泉水可捐
 *   - transport(运力):我有皮卡/船只可运
 *   - service(服务):我是医生/志愿者可支援
 *   - venue(场地):我有仓库/厂房可暂存
 *
 * 与 Help 在公开信息墙上并列展示,通过类别匹配,促进自发对接。
 */
import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true }, // OFFER-GX-2026-000001
    type: { type: String, enum: ['supplies', 'transport', 'service', 'venue', 'other'], required: true, index: true },
    category: { type: String, default: '' }, // 具体类别:饮用水/方便面/皮卡/船只/医生/仓库...
    title: { type: String, required: true }, // "可捐200箱矿泉水"
    description: { type: String, default: '' },

    // 数量与单位(物资类)
    quantity: { type: Number, default: null },
    unit: { type: String, default: '' },

    // 提供者
    provider: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' }, // 默认脱敏展示
      org: { type: String, default: '' }, // 组织(可选)
    },

    // 位置
    location: { type: String, default: '' },
    coordinates: { type: [Number], default: [] },
    canDeliver: { type: Boolean, default: false }, // 能否配送

    // 状态
    status: { type: String, enum: ['available', 'matched', 'fulfilled', 'expired'], default: 'available', index: true },

    // 时效
    validUntil: { type: Date, default: null }, // 失效时间(如"今晚前有效")
    eventId: { type: String, default: null, index: true },
    submittedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: 'offers' }
);

offerSchema.index({ type: 1, category: 1, status: 1 });
offerSchema.index({ coordinates: '2dsphere' });

export const Offer = mongoose.model('Offer', offerSchema);

export const OFFER_TYPE_LABELS = {
  supplies: '物资', transport: '运力', service: '服务', venue: '场地', other: '其他',
};
