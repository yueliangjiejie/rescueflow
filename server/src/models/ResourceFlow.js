/**
 * 物资调拨记录 —— 移植自 DRAP ResourceAllocation + ResourceUsage,合并为一张流转表。
 *
 * DRAP 分两张表(调拨 Allocation + 消耗 Usage),实践中容易脱节。
 * RescueFlow 合并为单张"物资流水",用 type 区分方向(入库/调拨/消耗/捐赠),
 * 形成完整审计链:谁、何时、向哪个避难所、什么物资、多少、流向。
 */
import mongoose from 'mongoose';

const resourceFlowSchema = new mongoose.Schema(
  {
    shelterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shelter', required: true, index: true },
    type: { type: String, enum: ['allocate', 'consume', 'donate'], required: true }, // 调拨/消耗/捐赠入库
    resources: [
      {
        resourceType: { type: String, required: true }, // 物资名称(冗余存储,字典变动不影响历史)
        quantity: { type: Number, required: true },
        unit: { type: String, default: '' },
        description: { type: String, default: '' },
      },
    ],
    operatorId: { type: String, default: '' }, // 操作人
    operatorName: { type: String, default: '' },
    fromParty: { type: String, default: '' }, // 来源/去向(捐赠人/救援队)
    note: { type: String, default: '' },
    eventId: { type: String, default: null, index: true },
  },
  { timestamps: true, collection: 'resource_flows' }
);

resourceFlowSchema.index({ shelterId: 1, createdAt: -1 });

export const ResourceFlow = mongoose.model('ResourceFlow', resourceFlowSchema);
