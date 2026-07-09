/**
 * 志愿者扩展模型(借鉴 DRAP Volunteer)—— User 之上的救援能力档案。
 *
 * DRAP 的核心亮点:skills(技能字典)+ taskStatus(可用状态),
 * 用于"按技能+可用性匹配志愿者派单"。
 * 此处保留其精髓,字段类型改用规范 ObjectId(修复 DRAP 的 String 引用缺陷)。
 */
import mongoose from 'mongoose';

const volunteerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // 技能(对应 Skill 字典 name):医疗/驾驶/搜救/心理疏导/翻译...
    skills: { type: [String], default: [] },
    // 资质文件路径(身份证明/资历证书)
    idProof: { type: String, default: '' },
    experienceCertificate: { type: String, default: '' },
    // 申请状态:0=待审核 1=通过 2=拒绝(借鉴 DRAP applicationStatus)
    applicationStatus: { type: Number, enum: [0, 1, 2], default: 0 },
    // 任务状态:0=空闲 1=已派单 2=执行中(借鉴 DRAP taskStatus)
    taskStatus: { type: Number, enum: [0, 1, 2], default: 0 },
    // 服务区域(经纬度 + 文字),用于就近匹配
    serviceArea: {
      coordinates: { type: [Number], default: [] }, // [lng, lat]
      address: { type: String, default: '' },
    },
    available: { type: Boolean, default: true },
    completedCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'volunteers' }
);

// 技能 + 可用性复合查询(派单匹配主力)
volunteerSchema.index({ skills: 1, taskStatus: 1, available: 1 });

export const Volunteer = mongoose.model('Volunteer', volunteerSchema);
