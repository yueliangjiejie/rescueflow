/**
 * 留痕服务 —— 哈希链写入器(并发安全)。
 *
 * ⚠️ 关键修复:之前"取 tail → 算 hash → 写入"非原子,并发会断链/分叉。
 *
 * 新方案(三重保障):
 *   1. 首选 MongoDB 事务:取 seq + 写入在同一事务,原子完成。
 *   2. 唯一索引 (entityType, entityId, seq) 兜底:即使无事务(单节点),
 *      并发产生相同 seq 会触发 E11000,服务层捕获后重试。
 *   3. 重试上限 + 指数退避,避免雪崩。
 *
 *   每条 hash = SHA256(prevHash + canonicalJson(payload))
 */
import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';

function canonicalJson(obj) {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  return JSON.stringify(sortKeys(obj));
}

function sortKeys(obj) {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((acc, k) => {
        acc[k] = sortKeys(obj[k]);
        return acc;
      }, {});
  }
  return obj;
}

// node:crypto,ESM 动态加载一次缓存
let _crypto;
async function getCrypto() {
  if (!_crypto) _crypto = await import('node:crypto');
  return _crypto;
}

async function sha256Async(s) {
  const c = await getCrypto();
  return c.createHash('sha256').update(s, 'utf8').digest('hex');
}

const MAX_RETRY = 5;
const GENESIS_HASH = '0'.repeat(64);

/**
 * 构造本条的载荷与 hash(纯计算,无 IO)。
 */
function buildPayload(entry, seq, prevHash) {
  const payload = {
    seq,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action || '',
    fromStatus: entry.fromStatus ?? null,
    toStatus: entry.toStatus ?? null,
    actorId: entry.actorId || '',
    actorRole: entry.actorRole || '',
    summary: entry.summary || '',
    changes: entry.changes ?? null,
    ip: entry.ip || '',
    userAgent: entry.userAgent || '',
    createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : new Date().toISOString(),
  };
  return payload;
}

/**
 * 写入一条留痕(并发安全)。
 * @param {object} entry  不含 seq/prevHash/hash
 * @returns {Promise<object>} 已落库的 AuditLog
 */
export async function appendAudit(entry) {
  const { entityType, entityId } = entry;
  if (!entityType || !entityId) {
    throw new Error('appendAudit 需要 entityType 与 entityId');
  }

  let attempt = 0;
  let lastErr;
  while (attempt < MAX_RETRY) {
    attempt++;
    try {
      // 尝试事务(MongoDB 副本集/Atlas 支持;单节点会抛错进入 catch 退化为重试模式)
      if (mongoose.connection.readyState === 1) {
        const session = await mongoose.startSession();
        try {
          return await session.withTransaction(async () => {
            const tail = await AuditLog.findOne({ entityType, entityId })
              .sort({ seq: -1 })
              .session(session)
              .exec();
            const seq = tail ? tail.seq + 1 : 1;
            const prevHash = tail ? tail.hash : GENESIS_HASH;
            const payload = buildPayload(entry, seq, prevHash);
            const hash = await sha256Async(prevHash + canonicalJson(payload));
            return AuditLog.create([payload].map((p) => ({ ...p, prevHash, hash })), { session }).then((r) => r[0]);
          });
        } finally {
          await session.endSession();
        }
      }
      // 退化为重试模式(无事务)
      const created = await tryWriteOnce(entry);
      return created;
    } catch (e) {
      lastErr = e;
      // E11000 = 唯一索引冲突(并发产生了相同 seq),退避后重试
      if (e?.code === 11000 || e?.name === 'MongoServerError' && e.code === 11000) {
        await new Promise((r) => setTimeout(r, 20 * attempt));
        continue;
      }
      // 事务不支持(单节点)→ 退化为重试模式,只重写一次
      if (attempt === 1 && /transaction|sessions are not supported/i.test(e.message || '')) {
        try { return await tryWriteOnce(entry); } catch (e2) { lastErr = e2; if (e2.code === 11000) { continue; } throw e2; }
      }
      throw e;
    }
  }
  throw lastErr || new Error('appendAudit 重试耗尽');
}

/** 无事务的写入尝试(配合唯一索引 + 调用方重试保证安全) */
async function tryWriteOnce(entry) {
  const { entityType, entityId } = entry;
  const tail = await AuditLog.findOne({ entityType, entityId }).sort({ seq: -1 }).exec();
  const seq = tail ? tail.seq + 1 : 1;
  const prevHash = tail ? tail.hash : GENESIS_HASH;
  const payload = buildPayload(entry, seq, prevHash);
  const hash = await sha256Async(prevHash + canonicalJson(payload));
  return AuditLog.create({ ...payload, prevHash, hash });
}

/**
 * 校验某实体留痕链完整性。返回第一条断链位置。
 */
export async function verifyAuditChain(entityType, entityId) {
  const chain = await AuditLog.find({ entityType, entityId }).sort({ seq: 1 }).lean().exec();
  let prevHash = GENESIS_HASH;
  for (const doc of chain) {
    if (doc.prevHash !== prevHash) return { ok: false, brokenAt: doc.seq, reason: 'prevHash 不匹配' };
    const { hash: _omit, prevHash: _omit2, _id, __v, updatedAt, ...payload } = doc;
    const recomputed = await sha256Async(prevHash + canonicalJson(payload));
    if (recomputed !== doc.hash) return { ok: false, brokenAt: doc.seq, reason: 'hash 不匹配' };
    prevHash = doc.hash;
  }
  return { ok: true, brokenAt: null, reason: null };
}
