/**
 * 留痕模型 —— append-only + 哈希链(防篡改)。
 *
 * 哈希链算法:
 *   每条记录的字段集合(除 hash 外)按稳定顺序拼成规范 JSON,
 *   再与上一条的 hash 串联,做一次 SHA-256,得到本条 hash。
 *   hash = SHA256(prevHash + canonicalJson(本条除 hash 外字段))
 *
 *   链上任意一环被改,其后所有 hash 都对不上 —— 实现"可验证留痕"。
 *
 * 注意:本集合只允许 insert,禁止 update/delete(由服务层约束 + DB 层权限)。
 */
import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    seq: { type: Number, required: true }, // 同 entityType+entityId 内单调
    prevHash: { type: String, required: true, default: '0'.repeat(64) },
    hash: { type: String, required: true },

    entityType: { type: String, required: true, index: true }, // help | event | user
    entityId: { type: String, required: true, index: true },

    action: { type: String, required: true }, // AuditAction
    fromStatus: { type: String, default: null },
    toStatus: { type: String, default: null },

    actorId: { type: String, default: '' },
    actorRole: { type: String, default: '' },
    summary: { type: String, default: '' },

    changes: { type: mongoose.Schema.Types.Mixed, default: null },

    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true, collection: 'audit_logs' }
);

// ⭐ 唯一索引:同一实体的 seq 不可重复。这是并发安全的最后防线
// 即使事务不可用(单节点 MongoDB),并发写入产生相同 seq 时,第二个会 E11000 冲突,
// 由服务层捕获后重试,取新的 seq 再写。杜绝断链。
auditLogSchema.index({ entityType: 1, entityId: 1, seq: 1 }, { unique: true });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
