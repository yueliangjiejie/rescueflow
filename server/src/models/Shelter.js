/**
 * 避难所模型 —— 移植自 DRAP Shelter,修正引用类型 + ESM 化。
 *
 * 核心亮点(直接照搬 DRAP):pre('save') 自动计算 available = inmates < totalCapacity。
 * 灾民登记/离开时自动同步避难所可用状态。
 *
 * 扩展:关联 event、经纬度用 GeoJSON 坐标、内部编号 SHE-{REGION}-{YEAR}-{seq}。
 */
import mongoose from 'mongoose';

const shelterSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true }, // SHE-GX-2026-000001
    name: { type: String, default: '' },
    location: { type: String, default: '' }, // 文字地址
    coordinates: { type: [Number], default: [] }, // [lng, lat]
    totalCapacity: { type: Number, default: 0 },
    inmates: { type: Number, default: 0 }, // 当前人数
    contactDetails: { type: String, default: '' },
    assignedVolunteer: { type: mongoose.Schema.Types.ObjectId, ref: 'Volunteer', default: null },
    available: { type: Boolean, default: true },
    eventId: { type: String, default: null, index: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'shelters' }
);

// 地理索引(地图展示用)
shelterSchema.index({ coordinates: '2dsphere' });

// ⭐ DRAP 原样保留:自动计算可用状态
shelterSchema.pre('save', function (next) {
  if (this.totalCapacity > 0) {
    this.available = this.inmates < this.totalCapacity;
  }
  next();
});

export const Shelter = mongoose.model('Shelter', shelterSchema);
