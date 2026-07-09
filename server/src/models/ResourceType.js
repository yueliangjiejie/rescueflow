/**
 * 物资类型字典 —— 移植自 DRAP ResourceType。
 * 规范化物资名称,便于统计与匹配。预置常用项。
 */
import mongoose from 'mongoose';

const resourceTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    category: { type: String, default: 'general' }, // food / water / medical / clothing / other
    unit: { type: String, default: '' }, // 默认单位(箱/瓶/包/件)
    builtin: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'resource_types' }
);

export const ResourceType = mongoose.model('ResourceType', resourceTypeSchema);

export const BUILTIN_RESOURCE_TYPES = [
  { name: '饮用水', category: 'water', unit: '瓶' },
  { name: '方便食品', category: 'food', unit: '箱' },
  { name: '大米', category: 'food', unit: '袋' },
  { name: '棉被', category: 'clothing', unit: '床' },
  { name: '帐篷', category: 'other', unit: '顶' },
  { name: '常用药品', category: 'medical', unit: '包' },
  { name: '消毒用品', category: 'medical', unit: '瓶' },
  { name: '手电筒', category: 'other', unit: '个' },
];
