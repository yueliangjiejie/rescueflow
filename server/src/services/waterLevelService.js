/**
 * 水位服务 —— 上报、聚合态势(涨势地图、区域分布)。
 */
import { WaterLevel, WATER_LEVEL_DANGER } from '../models/WaterLevel.js';

/**
 * 上报一条水位记录。
 */
export async function reportWaterLevel(input) {
  return WaterLevel.create({
    location: input.location,
    coordinates: input.coordinates || [],
    province: input.province || '',
    city: input.city || '',
    district: input.district || '',
    level: input.level,
    trend: input.trend || 'unknown',
    depthCm: input.depthCm ?? null,
    description: input.description || '',
    reporterId: input.reporterId || '',
    reporterRole: input.reporterRole || 'public',
    verified: input.reporterRole === 'official',
    eventId: input.eventId || null,
    observedAt: input.observedAt || new Date(),
  });
}

/**
 * 最新水位地图(按地点去重,取每个地点的最新一条)。
 * 用于地图展示:哪些点危险、哪些在恶化。
 */
export async function latestWaterLevels({ hours = 24, levelMin } = {}) {
  const since = new Date(Date.now() - hours * 3600000);
  const match = { observedAt: { $gte: since } };
  if (levelMin != null) match.level = { $gte: levelMin };

  // 聚合:每个地点取最新一条
  return WaterLevel.aggregate([
    { $match: match },
    { $sort: { observedAt: -1 } },
    {
      $group: {
        _id: '$location',
        doc: { $first: '$$ROOT' },
      },
    },
    { $replaceRoot: { newRoot: '$doc' } },
    { $sort: { level: -1, observedAt: -1 } },
    { $limit: 500 },
  ]).exec();
}

/**
 * 区域态势分布:按区县聚合最高水位 + 危险点数。
 * 指挥部一眼看出哪个区最危急。
 */
export async function regionBreakdown({ hours = 24 } = {}) {
  const since = new Date(Date.now() - hours * 3600000);
  return WaterLevel.aggregate([
    { $match: { observedAt: { $gte: since } } },
    {
      $group: {
        _id: { province: '$province', city: '$city', district: '$district' },
        maxLevel: { $max: '$level' },
        dangerCount: { $sum: { $cond: [{ $gte: ['$level', WATER_LEVEL_DANGER] }, 1, 0] } },
        total: { $sum: 1 },
        latestAt: { $max: '$observedAt' },
      },
    },
    { $sort: { maxLevel: -1, dangerCount: -1 } },
  ]).exec();
}
