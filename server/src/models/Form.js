/**
 * 多灾种自定义表单(借鉴 Ushahidi Form/Stage/Attribute 三层模型)。
 *
 * 设计:一个 Form(如"洪涝求助")有多个 Stage(阶段/分页),
 * 每个 Stage 有多个 Attribute(字段)。求助创建时绑定 formId,
 * 自定义字段值存在 help.formData(Mixed)里。
 *
 * 价值:加新灾种 = 后台配一个 Form,零代码改。
 *
 * Ushahidi 的"核实用 Stage 而非布尔字段"思想:把核实环节做成一个
 * required=true 的 Stage,字段含 verified_by/method/at,必须填完才能发布。
 */
import mongoose from 'mongoose';

const attributeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // 字段标识,如 water_level
    label: { type: String, required: true }, // 显示名,如"水位高度"
    type: { type: String, enum: ['text', 'number', 'date', 'location', 'select', 'media', 'markdown'], default: 'text' },
    required: { type: Boolean, default: false },
    options: { type: [String], default: [] }, // select 的选项
    priority: { type: Number, default: 0 },
  },
  { _id: false }
);

const stageSchema = new mongoose.Schema(
  {
    label: { type: String, required: true }, // "信息录入" / "核实" / "派发"
    priority: { type: Number, default: 0 },
    required: { type: Boolean, default: false }, // ⭐ 工作流闸门:必须完成才能 publish
    showWhenPublished: { type: Boolean, default: true }, // 该阶段字段是否对外展示
    isInternalOnly: { type: Boolean, default: false }, // 仅内部可见(如派发队伍)
    attributes: { type: [attributeSchema], default: [] },
  },
  { _id: false }
);

const formSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // "洪涝求助" / "震情上报"
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    color: { type: String, default: '#1989fa' }, // 地图标记色
    stages: { type: [stageSchema], default: [] },
  },
  { timestamps: true, collection: 'forms' }
);

export const Form = mongoose.model('Form', formSchema);

/**
 * 预置表单(启动时 ensure)。
 * 每个灾种一个表单,含"录入"和"核实"两个 Stage。
 */
export const BUILTIN_FORMS = [
  {
    name: '洪涝求助',
    slug: 'flood',
    color: '#ee0a24',
    description: '洪涝灾害求助登记',
    stages: [
      {
        label: '信息录入', priority: 0, required: true,
        attributes: [
          { key: 'water_level', label: '水位情况', type: 'select', options: ['及踝', '齐膝', '齐腰', '齐胸', '更高'], required: true, priority: 1 },
          { key: 'power_outage', label: '是否断电', type: 'select', options: ['是', '否'], priority: 2 },
          { key: 'boat_needed', label: '是否需船只转移', type: 'select', options: ['是', '否'], priority: 3 },
        ],
      },
      {
        label: '核实', priority: 1, required: true, isInternalOnly: true,
        attributes: [
          { key: 'verified_by', label: '核实人', type: 'text', required: true, priority: 1 },
          { key: 'verified_method', label: '核实方式', type: 'select', options: ['电话', '短信', '现场'], required: true, priority: 2 },
          { key: 'verified_at', label: '核实时间', type: 'date', priority: 3 },
        ],
      },
    ],
  },
  {
    name: '震情上报',
    slug: 'earthquake',
    color: '#ff976a',
    description: '地震灾情上报',
    stages: [
      {
        label: '信息录入', priority: 0, required: true,
        attributes: [
          { key: 'felt_intensity', label: '震感强度', type: 'select', options: ['轻微', '明显', '强烈', '剧烈'], required: true, priority: 1 },
          { key: 'building_damage', label: '建筑受损', type: 'select', options: ['无', '裂缝', '倾斜', '倒塌'], priority: 2 },
          { key: 'trapped', label: '是否有人员被困', type: 'select', options: ['是', '否'], priority: 3 },
        ],
      },
      {
        label: '核实', priority: 1, required: true, isInternalOnly: true,
        attributes: [
          { key: 'verified_by', label: '核实人', type: 'text', required: true, priority: 1 },
          { key: 'verified_method', label: '核实方式', type: 'select', options: ['电话', '短信', '现场'], required: true, priority: 2 },
        ],
      },
    ],
  },
];
