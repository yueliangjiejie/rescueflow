/**
 * 技能字典(借鉴 DRAP Skill)—— 规范化救援技能选项。
 * 预置常用项,运维可扩展。
 */
import mongoose from 'mongoose';

const skillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    category: { type: String, default: 'general' }, // medical / rescue / logistics / communication / general
    description: { type: String, default: '' },
    builtin: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'skills' }
);

export const Skill = mongoose.model('Skill', skillSchema);

/** 预置技能(启动时 ensure 调用) */
export const BUILTIN_SKILLS = [
  { name: '医疗急救', category: 'medical' },
  { name: '水域救援', category: 'rescue' },
  { name: '山地搜救', category: 'rescue' },
  { name: '车辆驾驶', category: 'logistics' },
  { name: '物资搬运', category: 'logistics' },
  { name: '心理疏导', category: 'medical' },
  { name: '方言翻译', category: 'communication' },
  { name: '信息核实', category: 'communication' },
];
