/**
 * 重复检测服务 —— 解决"救命文档"最痛的问题:同一求救被登记多次。
 *
 * 三维度综合判定(全部满足才算疑似重复):
 *   1. 时间窗口:提交时间接近(默认 6 小时内)
 *   2. 地理邻近:经纬度距离在阈值内(默认 500 米)
 *   3. 文本相似:关键词重合度(Jaccard)≥ 阈值,或手机号相同
 *
 * 设计原则(AI 仅辅助):
 *   - 只【提示】疑似重复,不拦截登记(灾时宁可多登一条,也不能漏掉真实求救)
 *   - 由人工在后台确认合并(把重复项标记 abnormal=duplicate,指向正本)
 *
 * 性能:
 *   - 用地理 bbox + 时间范围先粗筛(走索引),再细算距离/相似度
 *   - 新登记时同步检测一次(轻量),后台列表可批量扫描
 */
import { Help } from '../models/Help.js';

// Haversine 距离(米)
function haversineMeters(aLng, aLat, bLng, bLat) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 中文分词:按非汉字/非字母数字字符切分 + 2-gram 兜底(轻量,无依赖)
const STOPWORDS = new Set(['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这']);
function tokenize(text) {
  if (!text) return new Set();
  const cleaned = String(text).toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9]/gi, ' ');
  const unigrams = cleaned.split(/\s+/).filter(Boolean);
  // 中文 2-gram:相邻汉字成对
  const hans = String(text).match(/[\u4e00-\u9fa5]/g) || [];
  const bigrams = [];
  for (let i = 0; i < hans.length - 1; i++) bigrams.push(hans[i] + hans[i + 1]);
  const all = new Set([...unigrams, ...bigrams]);
  for (const sw of STOPWORDS) all.delete(sw);
  return all;
}

function jaccard(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  return inter / (setA.size + setB.size - inter);
}

/**
 * 检测一条新求助是否疑似重复。
 * @param {object} input { text, phone, lng, lat, submittedAt, excludeCode }
 * @param {object} opts { radiusMeters=500, hoursWindow=6, textThreshold=0.5 }
 * @returns {Promise<{ suspicious:boolean, matches:array }>}
 */
export async function detectDuplicate(input, opts = {}) {
  const {
    radiusMeters = 500,
    hoursWindow = 6,
    textThreshold = 0.3,
  } = opts;

  const { text, phone, lng, lat, submittedAt = new Date(), excludeCode } = input;
  const hasGeo = lng != null && lat != null;

  // 时间范围
  const since = new Date(new Date(submittedAt).getTime() - hoursWindow * 3600000);
  const until = new Date(new Date(submittedAt).getTime() + hoursWindow * 3600000);

  // 粗筛条件
  const filter = {
    submittedAt: { $gte: since, $lte: until },
    status: { $nin: ['done', 'archived'] },
  };
  if (excludeCode) filter.code = { $ne: excludeCode };
  if (phone) filter['person.phone'] = phone; // 手机号完全相同是最强信号,优先

  // 先按手机号精确查(最强)
  let candidates = [];
  if (phone) {
    candidates = await Help.find({ ...filter, 'person.phone': phone }).lean().exec();
  }
  // 再按地理 bbox 粗筛(走 2dsphere / 复合索引)
  if (hasGeo && candidates.length === 0) {
    const deg = radiusMeters / 111000; // 近似度数
    const geoFilter = {
      ...filter,
      'location.coordinates.0': { $gte: lng - deg, $lte: lng + deg },
      'location.coordinates.1': { $gte: lat - deg, $lte: lat + deg },
    };
    delete geoFilter['person.phone'];
    candidates = await Help.find(geoFilter).lean().exec();
  }

  if (!candidates.length) return { suspicious: false, matches: [] };

  // 细筛:距离 + 文本相似度
  const queryTokens = tokenize(text);
  const matches = [];
  for (const c of candidates) {
    const cLng = c.location?.coordinates?.[0];
    const cLat = c.location?.coordinates?.[1];
    let distance = null;
    if (hasGeo && cLng != null && cLat != null) {
      distance = haversineMeters(lng, lat, cLng, cLat);
      if (distance > radiusMeters) continue; // 超出半径
    }
    const cTokens = tokenize(c.content?.rawText || c.content?.summary || '');
    const sim = jaccard(queryTokens, cTokens);
    const phoneMatch = phone && c.person?.phone === phone;

    // 判定:手机号相同 → 强信号;否则需文本相似度达标
    const isDup = phoneMatch || (sim >= textThreshold && (distance == null || distance <= radiusMeters));
    if (isDup) {
      matches.push({
        code: c.code,
        submittedAt: c.submittedAt,
        distanceMeters: Math.round(distance) || null,
        textSimilarity: Number(sim.toFixed(2)),
        phoneMatch: !!phoneMatch,
        summary: c.content?.summary || c.content?.rawText?.slice(0, 40),
        score: Number((phoneMatch ? 1 : sim * 0.6 + (distance != null ? 0.4 * (1 - distance / radiusMeters) : 0)).toFixed(2)),
      });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return { suspicious: matches.length > 0, matches: matches.slice(0, 5) };
}
