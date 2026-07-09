/**
 * 报平安服务 + 道路通行服务(洪涝场景特有)。
 */
import { SafetyReport } from '../models/SafetyReport.js';

// ===== 报平安 =====

export async function reportSafe(input) {
  return SafetyReport.create({
    name: input.name,
    phone: input.phone || '',
    status: input.status || 'safe',
    message: input.message || '',
    currentLocation: input.currentLocation || '',
    shelterId: input.shelterId || null,
    helpCode: input.helpCode || null,
    eventId: input.eventId || null,
    reporterId: input.reporterId || '',
  });
}

/** 寻亲:按姓名/电话查询已报平安的人。 */
export async function searchSafety({ name, phone, status }) {
  const filter = {};
  if (name) filter.name = new RegExp(name, 'i');
  if (phone) filter.phone = phone;
  if (status) filter.status = status;
  return SafetyReport.find(filter).sort({ createdAt: -1 }).limit(100).lean().exec();
}

// ===== 道路通行(用 ResourceFlow 的思路,独立轻量模型) =====
// 直接复用一个通用的"通行状态"集合,不单独建文件,内联在此便于洪涝特化

import mongoose from 'mongoose';

const roadStatusSchema = new mongoose.Schema(
  {
    roadName: { type: String, required: true, index: true }, // 道路名/起点-终点
    coordinates: { type: [Number], default: [] },
    status: { type: String, enum: ['passable', 'difficult', 'impassable', 'unknown'], default: 'unknown', index: true },
    waterLevel: { type: Number, default: null }, // 该路段积水等级 0-6
    description: { type: String, default: '' },
    reporterId: { type: String, default: '' },
    verified: { type: Boolean, default: false },
    eventId: { type: String, default: null },
  },
  { timestamps: true, collection: 'road_status' }
);
roadStatusSchema.index({ coordinates: '2dsphere' });

export const RoadStatus = mongoose.model('RoadStatus', roadStatusSchema);

export async function reportRoad(input) {
  return RoadStatus.create({
    roadName: input.roadName,
    coordinates: input.coordinates || [],
    status: input.status,
    waterLevel: input.waterLevel ?? null,
    description: input.description || '',
    reporterId: input.reporterId || '',
    eventId: input.eventId || null,
  });
}

export async function listRoads({ status, hours = 24 } = {}) {
  const since = new Date(Date.now() - hours * 3600000);
  const match = { updatedAt: { $gte: since } };
  if (status) match.status = status;
  // 每条路取最新
  return RoadStatus.aggregate([
    { $match: match },
    { $sort: { updatedAt: -1 } },
    { $group: { _id: '$roadName', doc: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$doc' } },
    { $sort: { status: 1 } },
  ]).exec();
}

// ===== 转移链路状态(扩展 Help,不新建模型)=====
// 转移过程用 help.status 流转表达:pending→verified→transferred(派车船)→in_progress(途中/救援中)→done(到达/完成)
// 已有状态机覆盖,这里只补充转移特有信息
export const TRANSFER_INFO_FIELDS = ['transferVehicle', 'transferDepartedAt', 'transferArrivedAt', 'transferPassengers'];
