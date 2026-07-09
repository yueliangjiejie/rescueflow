/**
 * 灾民登记(安置点内)—— 移植自 DRAP Inmate。
 * 记录每个进入避难所的人员,支持后续寻亲与统计。
 *
 * 扩展:关联 event、增加特殊人员标记(与 Help 一致)、登记时间。
 */
import mongoose from 'mongoose';

const inmateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    place: { type: String, default: '' }, // 原住址
    age: { type: Number, default: 0 },
    contact: { type: String, default: '' }, // 联系电话
    shelterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shelter', required: true, index: true },
    eventId: { type: String, default: null, index: true },
    specialPersons: { type: [String], default: [] }, // 与 Help 一致的特殊人员标记
    checkedInAt: { type: Date, default: Date.now },
    checkedOutAt: { type: Date, default: null },
    status: { type: String, enum: ['in', 'out'], default: 'in' },
  },
  { timestamps: true, collection: 'inmates' }
);

// 寻亲查询主索引
inmateSchema.index({ name: 1, contact: 1 });

export const Inmate = mongoose.model('Inmate', inmateSchema);
