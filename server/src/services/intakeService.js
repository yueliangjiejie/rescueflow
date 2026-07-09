/**
 * 智能录入助手 —— 粘贴文本或链接,AI 自动拆解成结构化条目,人工确认后批量入库。
 *
 * 解决现场痛点:灾区信息散落在微信群/新闻/其他平台,逐条填表不现实。
 * 让 AI 干"信息整理",人只做"勾选确认"。
 *
 * 流程:
 *   预览  POST /api/intake/parse   { text?, url? } -> { items[] }   (不入库)
 *   入库  POST /api/intake/import   { items[] }    -> 批量创建
 */
import { parseBatch } from './aiService.js';
import { createHelp } from './helpService.js';
import { Help } from '../models/Help.js';
import { createOffer } from './offerService.js';
import { reportSafe } from './floodService.js';
import { reportWaterLevel } from './waterLevelService.js';

/**
 * 简单抓取网页正文(无依赖,够用)。
 * 失败/被墙时返回空,由调用方提示用户改用粘贴。
 */
async function fetchUrlText(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RescueFlowBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return '';
    const html = await res.text();
    // 去标签 + 解码常见实体,取正文
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000); // 防止超长文本
  } catch (e) {
    console.warn('[intake] 抓取链接失败:', e.message);
    return '';
  }
}

/**
 * 预览:解析文本/链接,返回拆解后的条目(不入库)。
 */
export async function parseIntake({ text, url }) {
  let source = '';
  if (url) {
    source = await fetchUrlText(url);
    if (!source) {
      const e = new Error('链接抓取失败,请改用直接粘贴文本');
      e.status = 400;
      throw e;
    }
  } else if (text) {
    source = text;
  } else {
    const e = new Error('请提供文本或链接');
    e.status = 400;
    throw e;
  }

  const { degraded, items } = await parseBatch(source);
  return {
    source: (url || '粘贴文本').slice(0, 80),
    sourceLength: source.length,
    degraded, // 是否降级(无AI key走规则)
    items: items.map((it, i) => ({ ...it, _tempId: `tmp-${Date.now()}-${i}` })),
  };
}

/**
 * 批量入库:人工勾选确认后的条目,逐条创建求助。
 * @param {array} items 预览返回的条目(子集)
 * @param {object} common 公共字段(eventId, source, actorId)
 */
export async function importIntake(items, common = {}) {
  const created = { need: [], offer: [], safety: [], water: [] };
  const failed = [];
  for (const it of items) {
    try {
      const kind = it.kind || 'need';
      if (kind === 'need') {
        const doc = await createHelp({
          rawText: it.summary || '',
          method: 'intake',
          reporterRelation: 'other',
          person: { name: it.name || '', phone: it.phone || '未知', specialPersons: it.specialPersons || [], headcount: it.headcount || 1 },
          location: { raw: it.location || '' },
          consent: true,
          submittedAt: new Date(),
          source: common.source || 'intake',
          actorId: common.actorId || 'intake-bot',
          eventId: common.eventId,
        });
        created.need.push(doc.code);
      } else if (kind === 'offer') {
        const o = await createOffer({
          type: it.type || 'other',
          title: it.summary || '互助供给',
          category: '',
          quantity: it.quantity,
          unit: it.unit || '',
          providerName: it.name || '',
          providerPhone: it.phone || '',
          location: it.location || '',
          eventId: common.eventId,
        });
        created.offer.push(o.code);
      } else if (kind === 'safety') {
        const s = await reportSafe({
          name: it.name || '', phone: it.phone || '', status: 'safe',
          message: it.summary || '', currentLocation: it.location || '',
          eventId: common.eventId,
        });
        created.safety.push(s._id?.toString() || 'safety');
      } else if (kind === 'water') {
        const w = await reportWaterLevel({
          location: it.location || '', level: 2, trend: 'unknown',
          description: it.summary || '', reporterRole: 'public',
          eventId: common.eventId,
        });
        created.water.push(w._id?.toString() || 'water');
      }
    } catch (e) {
      failed.push({ kind: it.kind, summary: it.summary, error: e.message });
    }
  }
  return {
    created,
    failed,
    summary: {
      need: created.need.length, offer: created.offer.length,
      safety: created.safety.length, water: created.water.length,
      failed: failed.length,
    },
  };
}
