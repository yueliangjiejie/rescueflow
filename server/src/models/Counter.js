/**
 * 编号计数器 —— 支撑并发安全的编号生成(V0.1 第7节)。
 *
 * 用 findOneAndUpdate + $inc 原子自增,杜绝并发下的序号重复。
 * 维度: { prefix, region, year } -> seq
 */
import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema(
  {
    prefix: { type: String, required: true, uppercase: true },
    region: { type: String, required: true, uppercase: true },
    year: { type: Number, required: true },
    seq: { type: Number, default: 0 },
  },
  { collection: 'counters' }
);

// 唯一维度
counterSchema.index({ prefix: 1, region: 1, year: 1 }, { unique: true });

/**
 * 原子获取下一个序号(并发安全)。
 * @returns {Promise<number>}
 */
counterSchema.statics.nextSeq = async function (prefix, region, year) {
  const doc = await this.findOneAndUpdate(
    { prefix, region: String(region).toUpperCase(), year },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  ).exec();
  return doc.seq;
};

export const Counter = mongoose.model('Counter', counterSchema);
