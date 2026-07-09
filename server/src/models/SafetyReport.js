/**
 * 报平安模型 —— 获救/安全者主动报安,家属可查询。
 *
 * 场景:救命文档里最催泪的是"求扩散找人"。反过来,
 * 安全的人主动报一声平安,是家属最需要的。
 *
 * 关联:可选关联 helpCode(由某次求助获救)、shelterId(在某安置点)。
 */
import mongoose from 'mongoose';

const safetySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, default: '', trim: true, index: true },
    status: { type: String, enum: ['safe', 'need_help', 'sheltered'], default: 'safe', index: true },
    message: { type: String, default: '' }, // 给家属的话
    currentLocation: { type: String, default: '' }, // 当前所在地
    shelterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shelter', default: null },
    helpCode: { type: String, default: null }, // 关联的求助编号
    eventId: { type: String, default: null, index: true },
    reporterId: { type: String, default: '' },
  },
  { timestamps: true, collection: 'safety_reports' }
);

// 寻亲查询主索引
safetySchema.index({ name: 1, phone: 1 });

export const SafetyReport = mongoose.model('SafetyReport', safetySchema);

export const SAFETY_STATUS_LABELS = {
  safe: '已安全', need_help: '仍需帮助', sheltered: '在安置点',
};
