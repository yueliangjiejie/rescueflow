/**
 * AI 适配层 —— OpenAI 兼容接口,后续可平滑切换国产模型。
 *
 * 核心原则(补充设计 + V0.1 第10节):
 *  - AI 仅辅助,不替代人工;所有建议都供人工确认。
 *  - 任何 AI 调用失败都【降级】为先存原文,绝不阻塞登记。
 *
 * 提供能力:语音转文字(若上游未转)、结构化提取、紧急度建议。
 * 重复检测见 duplicateService.js。
 */
import { env } from '../config/env.js';
import { Urgency } from '@rescueflow/shared';
import { recognizeOnce, isAsrReady } from './asrService.js';

function hasKey() {
  return Boolean(env.aiApiKey);
}

/**
 * 通用 chat completion 调用(失败返回 null,由调用方降级)。
 */
async function chat(messages, { json = false, temperature = 0.2 } = {}) {
  if (!hasKey()) return null;
  try {
    const res = await fetch(`${env.aiApiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.aiApiKey}`,
      },
      body: JSON.stringify({
        model: env.aiModel,
        messages,
        temperature,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!res.ok) {
      console.warn(`[ai] HTTP ${res.status}: ${await res.text().catch(() => '')}`);
      return null;
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.warn('[ai] 调用失败,降级:', e.message);
    return null;
  }
}

/**
 * 结构化提取 + 紧急度建议。
 * 输入群众原始文本,输出 { summary, needs[], urgency, address }。
 * 失败返回 degraded 结构。
 *
 * @param {string} rawText 群众原始文本(语音转写或手填)
 */
export async function extractAndScore(rawText) {
  if (!rawText || !rawText.trim()) {
    return { degraded: true, summary: '', needs: [], urgency: Urgency.MEDIUM, address: '' };
  }

  const text = await chat(
    [
      {
        role: 'system',
        content:
          '你是灾情求助信息整理助手。从群众原文提取结构化信息。' +
          '紧急度仅四档:critical(危及生命)/high(紧迫)/medium(一般)/low(报备)。' +
          '严格基于原文,不可臆测。返回 JSON。',
      },
      {
        role: 'user',
        content: `原文:${rawText}\n\n返回 JSON,字段:summary(一句话摘要),needs(需求类型数组,如 求救/物资/转移/医疗),urgency(四档之一),address(地址,若文中提及)`,
      },
    ],
    { json: true }
  );

  if (!text) {
    return { degraded: true, summary: rawText.slice(0, 80), needs: [], urgency: Urgency.MEDIUM, address: '' };
  }

  try {
    const parsed = JSON.parse(text);
    const valid = Object.values(Urgency);
    return {
      degraded: false,
      summary: String(parsed.summary || rawText.slice(0, 80)),
      needs: Array.isArray(parsed.needs) ? parsed.needs : [],
      urgency: valid.includes(parsed.urgency) ? parsed.urgency : Urgency.MEDIUM,
      address: parsed.address ? String(parsed.address) : '',
    };
  } catch {
    return { degraded: true, summary: rawText.slice(0, 80), needs: [], urgency: Urgency.MEDIUM, address: '' };
  }
}

/**
 * 语音转文字:优先用腾讯云一句话识别;未配置则降级返回空。
 * @param {Buffer|string} audio 音频字节或文件路径(本地)
 * @param {object} opts { fileType }
 * @returns {Promise<string>}
 */
/**
 * 批量拆解:把一段混杂信息(聊天记录/新闻/求助文本)拆成多条结构化求助条目。
 * 这是智能录入助手的核心:灾区信息散落各处,人工逐条录入不现实,
 *   AI 承担"信息整理"——把一锅粥的信息理成可入库的条目,人工只需勾选确认。
 *
 * 设计:
 *  - 没配 AI key → 用规则兜底(按换行/序号切分,尽力提取)
 *  - 配了 key → LLM 结构化抽取,返回标准化条目数组
 *  - AI 仅辅助:返回的是【建议】,最终入库由人工确认
 *
 * @param {string} raw 原始文本(可含多条信息)
 * @returns {Promise<{degraded:boolean, items:array}>}
 */
export async function parseBatch(raw) {
  if (!raw || !raw.trim()) return { degraded: true, items: [] };

  // 规则兜底(重写):按"信息主体"切分,而非物理换行。
  // 核心原则(参考顺丰):一条信息=一个发布者的完整表达。
  //  - 提取所有电话;若≤1个唯一电话,整段就是1条(不管多少行/编号)
  //  - 多个不同电话 → 才尝试按"电话+上下文"切多人
  //  - 末尾"联系方式"段(联系人/电话聚集)不单独切分,并回主体
  const ruleFallback = () => {
    const phones = Array.from(new Set((raw.match(/1[3-9]\d{9}/g) || [])));
    // 单电话或无电话 → 整段一条(这是最常见情况:招募/公告/流程)
    if (phones.length <= 1) {
      const it = extractFromChunk(raw);
      if (it.kind === 'ignore') return { degraded: true, items: [] };
      return { degraded: true, items: [it] };
    }
    // 多电话 → 尝试按电话定位切分:以每个电话为中心,取其前后文作为一个主体
    const phonePositions = [];
    const re = /1[3-9]\d{9}/g;
    let m;
    while ((m = re.exec(raw)) !== null) {
      phonePositions.push({ phone: m[0], index: m.index });
    }
    // 去重电话(同一号码重复出现,如例2 王武安出现两次)
    const uniquePhones = Array.from(new Set(phonePositions.map(p => p.phone)));
    const textLen = raw.length;
    // 判断电话是否"聚集"在末尾(联系方式区):
    //  1. 第一个电话位置 ≥ 全文 60% 处(说明前面是大段正文,电话在末尾)
    //  2. 或电话间距 ≤ 40 字符 且 总跨度 < 全文 30%
    const firstIdx = phonePositions[0].index;
    const lastEnd = phonePositions[phonePositions.length - 1].index + 11;
    const phoneSpan = lastEnd - firstIdx;
    const clustered =
      (firstIdx >= textLen * 0.6) ||   // 电话都在后 40%
      (phonePositions.length >= 2 && phoneSpan <= 40) ||
      (phonePositions.length >= 2 && phoneSpan / textLen < 0.3);
    // 多电话聚集在末尾 → 仍是同一条信息(只是列了多个联系人)
    if (clustered || uniquePhones.length <= 1) {
      const it = extractFromChunk(raw);
      if (it.kind !== 'ignore') return { degraded: true, items: [it] };
      return { degraded: true, items: [] };
    }
    // 多个分散的不同电话 → 按"自然段落"切分。
    // 段落定义:换行分隔的块;每个含电话的段落(或连续到下一个电话的块)作为一条。
    const items = [];
    // 按1-3个换行切段落
    const paragraphs = raw.split(/\n+/).map(s => s.trim()).filter(s => s);
    // 贪心合并:把连续段落合并,直到遇到下一个电话(即每个电话归到自己的条目)
    let current = [];
    let currentPhoneCount = 0;
    for (const para of paragraphs) {
      const paraPhones = (para.match(/1[3-9]\d{9}/g) || []).length;
      if (paraPhones > 0 && currentPhoneCount > 0) {
        // 当前段已含电话,新段又含电话 → 当前段封箱,新开一段
        if (current.length) {
          const seg = current.join('\n');
          const it = extractFromChunk(seg);
          if (it.kind !== 'ignore') items.push(it);
        }
        current = [para];
        currentPhoneCount = paraPhones;
      } else {
        current.push(para);
        currentPhoneCount += paraPhones;
      }
    }
    if (current.length) {
      const it = extractFromChunk(current.join('\n'));
      if (it.kind !== 'ignore') items.push(it);
    }
    return { degraded: true, items: items.length ? items : [extractFromChunk(raw)].filter(it => it.kind !== 'ignore') };
  };

  if (!hasKey()) return ruleFallback();

  const text = await chat(
    [
      {
        role: 'system',
        content:
          '你是灾情信息整理助手。用户粘贴一段混杂信息(微信群记录/新闻/多条信息)。' +
          '【最重要】先判定每条信息的【性质 kind】:' +
          'need=有人需要帮助(被困/缺物资/求救/求转移); ' +
          'offer=有人能提供帮助(我有物资/船只/可捐款/可支援); ' +
          'safety=报平安(我已安全/在安置点); ' +
          'water=水位水情; ' +
          'ignore=无关/寒暄/无明确信息。' +
          '\n【拆分规则 - 极重要】' +
          '1. 一个发布者的一次完整表达 = 一条,无论它换多少行、分多少章节;' +
          '2. 文本里的"一、二、三"或"1.2.3."编号通常是【同一文档的章节结构】,不是多条信息,必须合并;' +
          '3. 末尾"联系人/电话"区是同一条信息的联系方式,不要单独切分;' +
          '4. 只有【不同的人、不同的诉求】才算多条;' +
          '5. 优先合并:拿不准时默认一条,宁可少拆不要错拆。' +
          '\n提取字段:name姓名、phone电话(可多个,放数组)、location地点、summary用一句话概括整段。' +
          'need 类额外:urgency(critical/high/medium/low)、headcount、specialPersons。' +
          'offer 类额外:type(supplies物资/transport运力/service服务/venue场地)、quantity、unit。' +
          '无法确定的字段留空,不编造。返回 JSON。',
      },
      {
        role: 'user',
        content: `原始信息:\n${raw}\n\n返回 JSON,格式 {"items":[{"kind":"need|offer|safety|water|ignore","name":"","phone":"","location":"","summary":"","urgency":"","headcount":1,"specialPersons":[],"type":"","quantity":null,"unit":""}]}`,
      },
    ],
    { json: true }
  );

  if (!text) return ruleFallback();

  try {
    const parsed = JSON.parse(text);
    const items = Array.isArray(parsed) ? parsed : parsed.items || [];
    const validUrgency = Object.values(Urgency);
    const validKinds = ['need', 'offer', 'safety', 'water', 'ignore'];
    const validOfferTypes = ['supplies', 'transport', 'service', 'venue', 'other'];
    return {
      degraded: false,
      items: items
        .filter((it) => validKinds.includes(it.kind))
        .map((it) => ({
          kind: it.kind,
          name: String(it.name || '').trim(),
          phone: String(it.phone || '').trim(),
          location: String(it.location || '').trim(),
          summary: String(it.summary || '').trim(),
          urgency: it.kind === 'need' && validUrgency.includes(it.urgency) ? it.urgency : (it.kind === 'need' ? Urgency.MEDIUM : null),
          headcount: it.kind === 'need' ? (Number(it.headcount) || 1) : null,
          specialPersons: it.kind === 'need' && Array.isArray(it.specialPersons) ? it.specialPersons.filter((s) => s) : [],
          type: it.kind === 'offer' && validOfferTypes.includes(it.type) ? it.type : (it.kind === 'offer' ? 'other' : null),
          quantity: it.kind === 'offer' && it.quantity != null ? Number(it.quantity) : null,
          unit: it.kind === 'offer' ? String(it.unit || '') : '',
          confidence: it.confidence != null ? Number(it.confidence) : 0.85,
        })),
    };
  } catch {
    return ruleFallback();
  }
}

// 规则兜底:从单个文本块尽力提取(正则)+ 性质判定
function extractFromChunk(chunk) {
  const phoneMatch = chunk.match(/1[3-9]\d{9}/);
  // 性质判定(优先级:offer > safety > need > water;避免援助/求助被误判)
  // 注意:water 放最后,因为求助里常带"水到二楼"等词,需先排除求助信号
  let kind = 'need';
  if (/我有|可捐|可提供|可支援|能帮忙|免费|捐赠|我是.{0,6}(医生|司机|船|志愿者)/.test(chunk)) kind = 'offer';
  else if (/已安全|报平安|已转移|已到.{0,4}安置|我很好|勿念/.test(chunk)) kind = 'safety';
  else if (/求助|求救|被困|需转移|急需|需要|缺|断了|没电|没水|没药|急病|受伤/.test(chunk)) kind = 'need';
  else if (/水位|积水|涨水|决堤|齐.{0,2}(膝|腰|胸|脖)|水淹|水到/.test(chunk)) kind = 'water';
  else if (/^(好的|收到|谢谢|辛苦|加油)/.test(chunk)) kind = 'ignore';

  const specialMatch = {
    elderly: /老人|大爷|大妈|爷爷|奶奶/.test(chunk),
    child: /小孩|儿童|孩子|婴儿|宝宝/.test(chunk),
    pregnant: /孕妇|怀孕/.test(chunk),
    disabled: /残疾|行动不便|瘫痪|坐轮椅/.test(chunk),
    patient: /急病|受伤|生病|发病|医药/.test(chunk),
  };
  const specialPersons = Object.entries(specialMatch).filter(([, v]) => v).map(([k]) => k);
  const urgencyMatch = /紧急|危及|生命|快没|撑不住|马上|决堤/.test(chunk);

  // offer 类:识别类型
  let type = null, quantity = null, unit = '';
  if (kind === 'offer') {
    if (/船|冲锋舟|车|皮卡|卡车/.test(chunk)) type = 'transport';
    else if (/医生|护士|医疗|急救|心理/.test(chunk)) type = 'service';
    else if (/仓库|厂房|场地|学校/.test(chunk)) type = 'venue';
    else type = 'supplies';
    const qm = chunk.match(/(\d+)\s*(箱|瓶|件|包|床|顶|袋|吨|公斤|个)/);
    if (qm) { quantity = Number(qm[1]); unit = qm[2]; }
  }

  return {
    kind,
    name: kind === 'offer' ? (chunk.match(/我(是|叫)?([\u4e00-\u9fa5]{2,4})(?=[^族])/)||[])[2] || '' : '',
    phone: phoneMatch ? phoneMatch[0] : '',
    location: (chunk.match(/在([\u4e00-\u9fa5a-zA-Z0-9]{2,20}?)(?:,|,|有|需|水|可|请|。|!)/)||[])[1] || '',
    summary: chunk.slice(0, 80),
    urgency: kind === 'need' ? (urgencyMatch ? Urgency.CRITICAL : Urgency.MEDIUM) : null,
    headcount: kind === 'need' ? 1 : null,
    specialPersons: kind === 'need' ? specialPersons : [],
    type, quantity, unit,
    confidence: 0.55,
  };
}

export async function transcribe(audio, opts = {}) {
  if (!audio) return '';
  // 接收 Buffer
  if (Buffer.isBuffer(audio)) {
    return recognizeOnce(audio, opts);
  }
  // 接收本地文件路径
  if (typeof audio === 'string' && audio.startsWith('/')) {
    if (!isAsrReady()) return '';
    try {
      const fs = await import('node:fs');
      const buf = fs.readFileSync(audio);
      return recognizeOnce(buf, opts);
    } catch (e) {
      console.warn('[ai] 读取音频文件失败:', e.message);
      return '';
    }
  }
  return '';
}

export const isAiReady = hasKey;
