/**
 * 组织(承接方)模型 —— 救援队/NGO/政府部门的档案。
 *
 * 转交去向不再是手打,从组织库选;每个组织有详细联系信息、能力、服务区域。
 */
import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true }, // ORG-GX-2026-000001
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['rescue_team', 'ngo', 'government', 'enterprise', 'medical', 'other'], default: 'rescue_team' },
    contactName: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    contactWechat: { type: String, default: '' },
    address: { type: String, default: '' },
    coordinates: { type: [Number], default: [] },
    // 能力(可选,用于匹配)
    capabilities: { type: [String], default: [] }, // 水域救援/医疗/物资运输/搜救...
    serviceArea: { type: String, default: '' },
    // 状态
    active: { type: Boolean, default: true },
    verified: { type: Boolean, default: false }, // 是否已核验资质
    note: { type: String, default: '' },
  },
  { timestamps: true, collection: 'organizations' }
);

organizationSchema.index({ type: 1, active: 1 });

export const Organization = mongoose.model('Organization', organizationSchema);

export const ORG_TYPE_LABELS = {
  rescue_team: '救援队', ngo: '公益组织', government: '政府部门',
  enterprise: '企业', medical: '医疗机构', other: '其他',
};

export const BUILTIN_ORGS = [
  { name: '蓝天救援队', type: 'rescue_team', contactName: '张队长', contactPhone: '13500002001', capabilities: ['水域救援','山地搜救'], serviceArea: '广西全区', verified: true, address: '南宁市' },
  { name: '公羊救援队', type: 'rescue_team', contactName: '李队长', contactPhone: '13500002002', capabilities: ['水域救援','国际救援'], serviceArea: '全国', verified: true, address: '杭州市' },
  { name: 'XX市应急管理局', type: 'government', contactName: '王主任', contactPhone: '13500002003', serviceArea: 'XX市', verified: true, address: 'XX市' },
  { name: 'XX红十字会', type: 'ngo', contactName: '刘会长', contactPhone: '13500002004', capabilities: ['物资调配','医疗'], verified: true, address: 'XX市' },
];
