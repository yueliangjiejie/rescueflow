/**
 * 事件模型 —— 聚合容器(一次洪涝/震情)INC-{REGION}-{YEAR}-{seq}
 *
 * 一个事件聚合多条求助。V1 可不强制关联,求助独立流转;
 * 但保留 eventId 字段以便后续按事件聚合统计与导出。
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
  },
  { _id: false }
);

const statsSchema = new mongoose.Schema(
  {
    total: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    verified: { type: Number, default: 0 },
    done: { type: Number, default: 0 },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    region: { type: String, required: true, uppercase: true },
    status: { type: String, enum: ['active', 'closed'], default: 'active', index: true },
    description: { type: String, default: '' },
    center: { type: pointSchema, default: () => ({}) },
    startedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
    stats: { type: statsSchema, default: () => ({}) },
  },
  { timestamps: true, collection: 'events' }
);

// 地理索引(支持附近事件查询,V2 地图用)
eventSchema.index({ 'center.coordinates': '2dsphere' });

export const Event = mongoose.model('Event', eventSchema);
