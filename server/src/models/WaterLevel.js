/**
 * 水位上报模型 —— 洪涝灾害的态势核心数据。
 *
 * 群众/救援上报某地点的实时水位 + 趋势,系统聚合出"涨势地图":
 *   - 哪些区域在快速恶化(危险)
 *   - 下游是否有预警窗口
 *   - 救援能否进入(水深决定船/车/徒步)
 *
 * 水位等级(标准化,便于聚合):
 *   0=无积水 1=及踝 2=齐膝 3=齐腰 4=齐胸 5=齐脖以上/可致命 6=已淹没一层
 */
import mongoose from 'mongoose';

const waterLevelSchema = new mongoose.Schema(
  {
    // 地点
    location: { type: String, default: '' }, // 文字地址
    coordinates: { type: [Number], default: [] }, // [lng, lat]
    province: { type: String, default: '' },
    city: { type: String, default: '' },
    district: { type: String, default: '' },

    // 水位
    level: { type: Number, required: true, min: 0, max: 6, index: true },
    trend: { type: String, enum: ['rising', 'stable', 'falling', 'unknown'], default: 'unknown' }, // 涨/平/落
    depthCm: { type: Number, default: null }, // 实测深度(厘米),可选
    description: { type: String, default: '' }, // 现场描述

    // 上报元信息
    reporterId: { type: String, default: '' },
    reporterRole: { type: String, default: 'public' }, // public/volunteer/official
    verified: { type: Boolean, default: false },
    eventId: { type: String, default: null, index: true },
    observedAt: { type: Date, default: Date.now, index: true }, // 观测时间(可能晚于上报)
  },
  { timestamps: true, collection: 'water_levels' }
);

waterLevelSchema.index({ coordinates: '2dsphere' });
// 区域聚合主索引
waterLevelSchema.index({ province: 1, city: 1, district: 1, observedAt: -1 });

export const WaterLevel = mongoose.model('WaterLevel', waterLevelSchema);

// 水位等级标签(前端共享)
export const WATER_LEVEL_LABELS = {
  0: '无积水', 1: '及踝', 2: '齐膝', 3: '齐腰', 4: '齐胸', 5: '齐脖以上', 6: '已淹一层',
};
export const WATER_LEVEL_DANGER = 3; // 齐腰及以上为危险
