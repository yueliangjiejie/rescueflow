/**
 * 编号生成器 —— V0.1 第7节
 *
 * 格式: {PREFIX}-{REGION}-{YEAR}-{6位序号}
 *   事件   INC-GX-2026-000001
 *   求助   HELP-GX-2026-000001
 *
 * 设计要点:
 *  - 序号在同 (prefix, region, year) 内严格递增、并发安全。
 *  - 本文件提供【纯函数格式化】与【序列器接口】两部分:
 *      formatId(prefix, region, year, seq) —— 纯展示/校验用,无副作用
 *      createIdGenerator(counterStore)     —— 注入计数器存储,保证唯一性
 *  - 后端用 MongoDB 原子 findOneAndUpdate 实现计数器(见 server/models/counter.js),
 *    前端/测试可用内存计数器,保证 shared 层不直接耦合数据库。
 */

import { ID_PREFIX, DEFAULT_REGION, ID_YEAR } from './constants.js';

/**
 * 校验并格式化一个编号。
 * @param {string} prefix  ID_PREFIX 中的值
 * @param {string} region  省份/区域码,默认 'GX'
 * @param {number} year    年份,默认 ID_YEAR
 * @param {number} seq     序号(正整数)
 * @returns {string} e.g. 'HELP-GX-2026-000001'
 */
export function formatId(prefix, region = DEFAULT_REGION, year = ID_YEAR, seq) {
  if (!Object.values(ID_PREFIX).includes(prefix)) {
    throw new Error(`未知编号前缀: ${prefix}`);
  }
  if (!Number.isInteger(seq) || seq <= 0) {
    throw new Error(`序号必须为正整数: ${seq}`);
  }
  const regionCode = String(region || DEFAULT_REGION).toUpperCase();
  return `${prefix}-${regionCode}-${year}-${String(seq).padStart(6, '0')}`;
}

/**
 * 解析编号,返回各组成部分。失败返回 null。
 * @param {string} id e.g. 'HELP-GX-2026-000001'
 */
export function parseId(id) {
  if (typeof id !== 'string') return null;
  const m = id.match(/^([A-Z]+)-([A-Z]{2})-(\d{4})-(\d{6})$/);
  if (!m) return null;
  const [, prefix, region, yearStr, seqStr] = m;
  if (!Object.values(ID_PREFIX).includes(prefix)) return null;
  return {
    prefix,
    region,
    year: Number(yearStr),
    seq: Number(seqStr),
  };
}

/**
 * 创建编号生成器。
 *
 * @param {object} counterStore 计数器存储,需实现:
 *   nextSeq(prefix, region, year) -> Promise<number> | number
 *   返回该维度下的下一个序号(已自增)。
 * @returns {function} async (prefix, opts?) => Promise<string>
 *
 * 服务端用法:
 *   const genId = createIdGenerator(mongoCounterStore);
 *   const helpId = await genId(ID_PREFIX.HELP, { region: 'GX' });
 */
export function createIdGenerator(counterStore) {
  if (!counterStore || typeof counterStore.nextSeq !== 'function') {
    throw new Error('counterStore 必须实现 nextSeq(prefix, region, year)');
  }
  return async function genId(prefix, opts = {}) {
    const region = opts.region || DEFAULT_REGION;
    const year = opts.year || ID_YEAR;
    const seq = await counterStore.nextSeq(prefix, region, year);
    return formatId(prefix, region, year, seq);
  };
}

/**
 * 内存计数器(仅用于测试/前端兜底,服务端务必用 MongoDB 原子计数器)。
 */
export function createInMemoryCounter() {
  const store = new Map();
  return {
    nextSeq(prefix, region = DEFAULT_REGION, year = ID_YEAR) {
      const key = `${prefix}-${region}-${year}`;
      const next = (store.get(key) || 0) + 1;
      store.set(key, next);
      return next;
    },
  };
}
