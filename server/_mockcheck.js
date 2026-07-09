/**
 * Mock 后端 —— 纯内存,不依赖 MongoDB。
 * 用于本地快速预览前端效果,无需任何配置。
 *
 * 启动: node server/mock-server.js
 * 默认 http://localhost:3000
 *
 * 实现了群众端 + 管理后台需要的全部核心接口。
 */
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== 内存数据 =====
let helpSeq = 0;
const helps = [];
const upload = multer({ dest: '/tmp/rescueflow-uploads/' });

// ===== 表单定义(与 BUILTIN_FORMS 一致)=====
const FORMS = [
  {
    slug: 'flood', name: '洪涝求助', color: '#ee0a24', description: '洪涝灾害求助登记',
    stages: [
      { label: '信息录入', priority: 0, required: true, isInternalOnly: false,
        attributes: [
          { key: 'water_level', label: '水位情况', type: 'select', options: ['及踝','齐膝','齐腰','齐胸','更高'], required: true, priority: 1 },
          { key: 'power_outage', label: '是否断电', type: 'select', options: ['是','否'], priority: 2 },
          { key: 'boat_needed', label: '是否需船只转移', type: 'select', options: ['是','否'], priority: 3 },
        ] },
      { label: '核实', priority: 1, required: true, isInternalOnly: true,
        attributes: [
          { key: 'verified_by', label: '核实人', type: 'text', required: true, priority: 1 },
        ] },
    ],
  },
  {
    slug: 'earthquake', name: '震情上报', color: '#ff976a', description: '地震灾情上报',
    stages: [
      { label: '信息录入', priority: 0, required: true, isInternalOnly: false,
        attributes: [
          { key: 'felt_intensity', label: '震感强度', type: 'select', options: ['轻微','明显','强烈','剧烈'], required: true, priority: 1 },
          { key: 'building_damage', label: '建筑受损', type: 'select', options: ['无','裂缝','倾斜','倒塌'], priority: 2 },
          { key: 'trapped', label: '是否有人员被困', type: 'select', options: ['是','否'], priority: 3 },
        ] },
      { label: '核实', priority: 1, required: true, isInternalOnly: true,
        attributes: [{ key: 'verified_by', label: '核实人', type: 'text', required: true, priority: 1 }] },
    ],
  },
];

// ===== 工具 =====
const ok = (data = null, message = 'ok') => ({ code: 0, message, data });
const maskPhone = (p) => p && p.length >= 7 ? p.slice(0,3) + '****' + p.slice(-4) : p;
const maskName = (n) => n && n.length > 1 ? n[0] + '*'.repeat(n.length-1) : n;

// 预置 3 条示例数据(让后台列表/地图有内容可看)
function seedDemo() {
  const demos = [
    { urgency: 'critical', formId: 'flood', status: 'pending', resolved: false,
      rawText: '我家在XX村3组,水已到2楼,有老人和两个小孩,急需转移!', phone: '13812345678', name: '张建国',
      special: ['elderly','child'], loc: [108.32, 22.82], addr: '广西XX村3组',
      formData: { water_level: '齐腰', power_outage: '是', boat_needed: '是' } },
    { urgency: 'high', formId: 'earthquake', status: 'verified', resolved: false, credibility: 4,
      rawText: '老楼倾斜,墙体有裂缝,2户人家需要安置', phone: '13900001111', name: '李秀英',
      special: ['elderly'], loc: [104.07, 30.67], addr: '四川XX街道',
      formData: { felt_intensity: '明显', building_damage: '倾斜', trapped: '否' } },
    { urgency: 'medium', formId: 'flood', status: 'done', resolved: true,
      rawText: '断水两天,需要饮用水和食物', phone: '13722223333', name: '王芳',
      special: [], loc: [113.26, 23.13], addr: '广东XX社区',
      formData: { water_level: '及踝', power_outage: '否', boat_needed: '否' },
      outcome: { rescued: 0, treated: 0, missing: 0, note: '物资已送达' } },
  ];
  for (const d of demos) {
    helpSeq++;
    helps.push({
      _id: 'demo-' + helpSeq,
      code: `HELP-GX-2026-${String(helpSeq).padStart(6,'0')}`,
      eventId: null, formId: d.formId, formData: d.formData,
      status: d.status, urgency: d.urgency, credibility: d.credibility || 2,
      method: 'manual', reporterRelation: 'self', source: 'h5',
      submittedAt: new Date(Date.now() - helpSeq * 3600000).toISOString(),
      person: { name: d.name, phone: d.phone, specialPersons: d.special, headcount: d.special.length || 1, contactPreference: 'public' },
      content: { rawText: d.rawText, summary: d.rawText.slice(0,30), needs: [] },
      location: { coordinates: d.loc, address: d.addr, raw: d.addr },
      ai: { degraded: true }, attachments: [],
      claimedBy: null, resolved: d.resolved, outcome: d.outcome || { rescued:0,treated:0,missing:0,note:'' },
      slaBreached: false, hasSpecialPerson: d.special.length > 0, consent: true,
      verification: { method: '', note: '' },
      verifiedBy: d.status === 'verified' ? 'volunteer-1' : null,
    });
  }
}
seedDemo();

// ===== 路由 =====

// 健康检查
app.get('/api/health', (_req, res) => res.json(ok({ status: 'up', mock: true })));
app.get('/api/health/status', (_req, res) => res.json(ok({ mongo:'mock', wechat:'mock', map:'mock', ai:'mock', nodeEnv:'demo' })));

// 合规
app.get('/api/compliance/notice', (_req, res) => res.json(ok({ notice: '本平台为民间信息协同工具,不替代 110/119/120,不承诺救援。', retentionDays: 365 })));

// 表单
app.get('/api/forms', (_req, res) => res.json(ok(FORMS)));
app.get('/api/forms/:slug', (req, res) => {
  const f = FORMS.find(f => f.slug === req.params.slug);
  if (!f) return res.status(404).json(ok(null, '不存在'));
  res.json(ok(f));
});

// 技能
const SKILLS = [
  { name: '医疗急救', category: 'medical' },
  { name: '水域救援', category: 'rescue' },
  { name: '车辆驾驶', category: 'logistics' },
  { name: '心理疏导', category: 'medical' },
];
app.get('/api/skills', (_req, res) => {
  res.json(ok(SKILLS));
});

// 登记求助(核心)
app.post('/api/helps', (req, res) => {
  const b = req.body;
  if (!b?.consent) return res.status(400).json(ok(null, '必须勾选同意条款'));
  if (!b?.person?.phone) return res.status(400).json(ok(null, '联系方式必填'));
  helpSeq++;
  const doc = {
    _id: 'h-' + helpSeq,
    code: `HELP-GX-2026-${String(helpSeq).padStart(6,'0')}`,
    formId: b.formId || null, formData: b.formData || null,
    status: 'pending', urgency: b.urgency || 'medium', credibility: 2,
    method: b.method || 'manual', reporterRelation: b.reporterRelation || 'self', source: 'h5',
    submittedAt: b.submittedAt || new Date().toISOString(),
    person: { name: b.person?.name || '', phone: b.person?.phone, specialPersons: b.person?.specialPersons || [], headcount: b.person?.headcount || 1 },
    content: { rawText: b.rawText || '', summary: (b.rawText||'').slice(0,40), needs: [] },
    location: b.location || { coordinates: [] },
    ai: { degraded: true }, attachments: b.attachments || [],
    claimedBy: null, resolved: false, outcome: { rescued:0,treated:0,missing:0,note:'' },
    slaBreached: false, hasSpecialPerson: (b.person?.specialPersons?.length||0) > 0,
  };
  helps.unshift(doc);
  res.status(201).json(ok({ code: doc.code, urgency: doc.urgency }, '登记成功,待核实'));
});

// 文件上传(假)
app.post('/api/helps/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json(ok(null, '未提供文件'));
  helpSeq++;
  res.status(201).json(ok({ id: 'a-'+helpSeq, code: 'HELP-GX-2026-'+String(helpSeq).padStart(6,'0'), url: '/uploads/demo', type: req.file.mimetype.startsWith('audio') ? 'voice' : 'image' }));
});

// 后台列表
app.get('/api/admin/helps', (req, res) => {
  let list = [...helps];
  if (req.query.status) list = list.filter(h => h.status === req.query.status);
  if (req.query.urgency) list = list.filter(h => h.urgency === req.query.urgency);
  if (req.query.formId) list = list.filter(h => h.formId === req.query.formId);
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const items = list.slice((page-1)*pageSize, page*pageSize).map(h => ({...h, person: {...h.person, phone: maskPhone(h.person.phone), name: maskName(h.person.name)}}));
  res.json(ok({ items, total: list.length, page, pageSize }));
});

// 群众端列表/详情
app.get('/api/helps', (req, res) => {
  let list = [...helps];
  if (req.query.status) list = list.filter(h => h.status === req.query.status);
  const items = list.slice(0,20).map(h => ({...h, person: {...h.person, phone: maskPhone(h.person.phone), name: maskName(h.person.name)}}));
  res.json(ok({ items, total: list.length, page:1, pageSize:20 }));
});
app.get('/api/helps/:code', (req, res) => {
  const h = helps.find(h => h.code === req.params.code);
  if (!h) return res.status(404).json(ok(null,'未找到'));
  res.json(ok({...h, person: {...h.person, phone: maskPhone(h.person.phone), name: maskName(h.person.name)}}));
});

// 后台详情
app.get('/api/admin/helps/:code', (req, res) => {
  const h = helps.find(h => h.code === req.params.code);
  if (!h) return res.status(404).json(ok(null,'未找到'));
  res.json(ok({...h, person: {...h.person, phone: maskPhone(h.person.phone), name: maskName(h.person.name)}}));
});

// 留痕链(假数据)
app.get('/api/admin/helps/:code/audit', (req, res) => {
  res.json(ok([
    { seq:1, action:'create', actorId:'public', summary:'登记求助', createdAt: new Date(Date.now()-3600000).toISOString(), hash:'a1b2c3'.padEnd(64,'0') },
    { seq:2, action:'verify', actorId:'volunteer-1', summary:'核实通过', createdAt: new Date().toISOString(), hash:'d4e5f6'.padEnd(64,'0') },
  ]));
});

// 状态流转(简单实现)
app.post('/api/admin/helps/:code/:action', (req, res) => {
  const h = helps.find(h => h.code === req.params.code);
  if (!h) return res.status(404).json(ok(null,'未找到'));
  const action = req.params.action;
  if (action === 'transition') h.status = req.body.toStatus;
  else if (action === 'verify') { h.status = 'verified'; h.credibility = req.body.credibility || 3; }
  else if (action === 'transfer') { h.status = 'transferred'; h.transferredTo = req.body.transferredTo; }
  else if (action === 'abnormal') { h.status = 'abnormal'; h.abnormalReason = req.body.reason; }
  else if (action === 'claim') { h.claimedBy = req.body.actorId || 'me'; }
  else if (action === 'unclaim') { h.claimedBy = null; }
  else if (action === 'resolve') { h.resolved = req.body.resolved !== false; h.outcome = { rescued: req.body.rescued||0, treated: req.body.treated||0, missing: req.body.missing||0, note: req.body.note||'' }; }
  res.json(ok({ code: h.code, status: h.status, resolved: h.resolved, outcome: h.outcome }));
});

// 认领/脱险(群众端也走这个路径)
app.post('/api/helps/:code/:action', (req, res) => {
  const h = helps.find(h => h.code === req.params.code);
  if (!h) return res.status(404).json(ok(null,'未找到'));
  const action = req.params.action;
  if (action === 'claim') h.claimedBy = req.body.actorId || 'me';
  else if (action === 'unclaim') h.claimedBy = null;
  else if (action === 'resolve') { h.resolved = req.body.resolved !== false; h.outcome = { rescued: req.body.rescued||0, treated: req.body.treated||0, missing: req.body.missing||0, note: req.body.note||'' }; }
  res.json(ok({ code: h.code, resolved: h.resolved, claimedBy: h.claimedBy }));
});

// 明文(假)
app.get('/api/admin/helps/:code/reveal', (req, res) => {
  const h = helps.find(h => h.code === req.params.code);
  res.json(ok({ phone: h?.person?.phone || '', name: h?.person?.name || '' }));
});

// 志愿者匹配(假)
const MATCH_VOLUNTEERS = [
  { userId: 'v1', skills: ['医疗急救', '水域救援'], available: true, applicationStatus: 1 },
  { userId: 'v2', skills: ['车辆驾驶'], available: true, applicationStatus: 1 },
];
app.get('/api/volunteers/match', (_req, res) => {
  res.json(ok(MATCH_VOLUNTEERS));
});

// 重复检测(假数据,演示用)
app.get('/api/admin/helps/:code/duplicates', (req, res) => {
  const h = helps.find(h => h.code === req.params.code);
  res.json(ok({ suspicious: !!h, matches: h ? [
    { code: 'HELP-GX-2026-000099', submittedAt: new Date().toISOString(), distanceMeters: 120, textSimilarity: 0.72, phoneMatch: false, score: 0.8, summary: '疑似重复:同一地点相似求助' },
  ] : [] }));
});
app.post('/api/admin/helps/merge', (req, res) => {
  const { dupCode } = req.body || {};
  const h = helps.find(h => h.code === dupCode);
  if (h) { h.status = 'abnormal'; h.abnormalReason = 'duplicate'; }
  res.json(ok({ merged: dupCode, into: req.body.keepCode }));
});

// 导出 Excel(返回简单 CSV,演示用)
app.get('/api/admin/export', (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="helps.csv"');
  let list = [...helps];
  if (req.query.status) list = list.filter(h => h.status === req.query.status);
  const rows = ['编号,状态,紧急度,手机号,摘要'];
  for (const h of list) {
    rows.push(`${h.code},${h.status},${h.urgency},${maskPhone(h.person.phone)},"${h.content.summary}"`);
  }
  res.send('\ufeff' + rows.join('\n'));
});

// 登录(假)

// ===== 避难所 / 灾民 / 物资(移植自 DRAP,mock 数据)=====
const SHELTERS = [
  { _id: 'shelter-1', code: 'SHE-GX-2026-000001', name: '第一中学体育馆安置点', location: 'XX市第一中学',
    coordinates: [108.35, 22.84], totalCapacity: 500, inmates: 312, contactDetails: '13800000001', available: true },
  { _id: 'shelter-2', code: 'SHE-GX-2026-000002', name: '社区中心安置点', location: 'XX社区服务中心',
    coordinates: [108.33, 22.81], totalCapacity: 200, inmates: 198, contactDetails: '13800000002', available: true },
  { _id: 'shelter-3', code: 'SHE-GX-2026-000003', name: '体育场安置点', location: 'XX市体育场',
    coordinates: [104.08, 30.66], totalCapacity: 1000, inmates: 1000, contactDetails: '13800000003', available: false },
];
const INMATES = [
  { _id: 'inm-1', name: '张建国', place: 'XX村3组', age: 68, contact: '13812345678', shelterId: 'shelter-1', status: 'in', checkedInAt: new Date(Date.now()-86400000).toISOString(), specialPersons: ['elderly'] },
  { _id: 'inm-2', name: '李秀英', place: 'XX街道', age: 72, contact: '13900001111', shelterId: 'shelter-1', status: 'in', checkedInAt: new Date(Date.now()-43200000).toISOString(), specialPersons: ['elderly'] },
];
const RESOURCE_TYPES = [
  { name: '饮用水', category: 'water', unit: '瓶' }, { name: '方便食品', category: 'food', unit: '箱' },
  { name: '棉被', category: 'clothing', unit: '床' }, { name: '常用药品', category: 'medical', unit: '包' },
  { name: '帐篷', category: 'other', unit: '顶' },
];
const RESOURCE_FLOWS = [
  { _id:'rf-1', shelterId:'shelter-1', type:'allocate', operatorName:'管理员', fromParty:'民政物资库',
    resources:[{resourceType:'饮用水',quantity:500,unit:'瓶'},{resourceType:'方便食品',quantity:100,unit:'箱'}], createdAt:new Date(Date.now()-86400000).toISOString() },
  { _id:'rf-2', shelterId:'shelter-1', type:'donate', operatorName:'王芳', fromParty:'热心市民捐赠',
    resources:[{resourceType:'棉被',quantity:80,unit:'床'}], createdAt:new Date(Date.now()-43200000).toISOString() },
  { _id:'rf-3', shelterId:'shelter-1', type:'consume', operatorName:'志愿者小陈',
    resources:[{resourceType:'饮用水',quantity:120,unit:'瓶'},{resourceType:'方便食品',quantity:15,unit:'箱'}], createdAt:new Date(Date.now()-3600000).toISOString() },
];

app.get('/api/resource-types', (_req, res) => res.json(ok(RESOURCE_TYPES)));
app.get('/api/shelters', (req, res) => {
  let list = SHELTERS.filter(s => true);
  if (req.query.availableOnly === 'true') list = list.filter(s => s.available);
  res.json(ok(list));
});
app.post('/api/shelters', (req, res) => {
  res.status(201).json(ok({ id: 'shelter-new', code: 'SHE-GX-2026-000099', available: true }, '避难所已创建'));
});
app.get('/api/shelters/:id', (req, res) => {
  const s = SHELTERS.find(s => s._id === req.params.id);
  res.json(ok(s || null));
});
app.post('/api/shelters/:id/inmates', (req, res) => {
  const s = SHELTERS.find(s => s._id === req.params.id);
  if (s) s.inmates++;
  res.status(201).json(ok({ id: 'inm-new' }, '登记成功'));
});
app.post('/api/inmates/:id/checkout', (_req, res) => res.json(ok({ status: 'out' })));
app.get('/api/inmates/search', (req, res) => {
  let list = INMATES;
  if (req.query.name) list = list.filter(i => i.name.includes(req.query.name));
  if (req.query.contact) list = list.filter(i => i.contact === req.query.contact);
  res.json(ok(list));
});
app.post('/api/resource-flows', (req, res) => res.status(201).json(ok({ id: 'rf-new' }, '物资流水已记录')));
app.get('/api/inventory', (req, res) => {
  // 汇总某避难所库存(简化:从 RESOURCE_FLOWS 算)
  const sid = req.query.shelterId;
  const stock = {};
  for (const f of RESOURCE_FLOWS) {
    if (sid && f.shelterId !== sid) continue;
    const sign = f.type === 'consume' ? -1 : 1;
    for (const r of f.resources) {
      if (!stock[r.resourceType]) stock[r.resourceType] = { qty: 0, unit: r.unit };
      stock[r.resourceType].qty += sign * r.quantity;
    }
  }
  const result = Object.entries(stock).map(([name, v]) => ({ name, quantity: v.qty, unit: v.unit, low: v.qty < 0 }));
  res.json(ok(result));
});

app.post('/api/auth/login', (req, res) => {

// ===== 洪涝场景:水位/报平安/道路/态势(广西→广东真实场景 mock)=====
const WATER_LEVELS = [
  { _id:'wl-1', location:'南宁邕江段', coordinates:[108.37,22.82], province:'广西', city:'南宁', district:'青秀区', level:5, trend:'rising', depthCm:140, description:'水已齐脖以上,一楼进水', observedAt:new Date(Date.now()-1800000).toISOString(), verified:true },
  { _id:'wl-2', location:'梧州西江段', coordinates:[111.30,23.47], province:'广西', city:'梧州', district:'长洲区', level:4, trend:'rising', depthCm:120, description:'齐胸水位,还在涨', observedAt:new Date(Date.now()-3600000).toISOString() },
  { _id:'wl-3', location:'贵港港北区', coordinates:[109.60,23.10], province:'广西', city:'贵港', district:'港北区', level:3, trend:'rising', depthCm:90, description:'齐腰,主干道积水', observedAt:new Date(Date.now()-7200000).toISOString() },
  { _id:'wl-4', location:'肇庆端州区', coordinates:[112.47,23.05], province:'广东', city:'肇庆', district:'端州区', level:2, trend:'rising', depthCm:55, description:'齐膝,上游来水增加', observedAt:new Date(Date.now()-5400000).toISOString() },
  { _id:'wl-5', location:'佛山三水区', coordinates:[112.90,23.16], province:'广东', city:'佛山', district:'三水区', level:1, trend:'unknown', depthCm:25, description:'及踝,低洼处开始积水', observedAt:new Date(Date.now()-10800000).toISOString() },
  { _id:'wl-6', location:'柳州柳江段', coordinates:[109.43,24.33], province:'广西', city:'柳州', district:'城中区', level:6, trend:'rising', depthCm:200, description:'已淹一层,紧急转移中', observedAt:new Date(Date.now()-900000).toISOString(), verified:true },
];
const SAFETY_REPORTS = [
  { _id:'sf-1', name:'张建国', phone:'13812345678', status:'sheltered', message:'我和老伴已到第一中学安置点,平安', currentLocation:'第一中学安置点', createdAt:new Date(Date.now()-7200000).toISOString() },
  { _id:'sf-2', name:'李秀英', phone:'13900001111', status:'safe', message:'已转移,水没进来', currentLocation:'亲戚家', createdAt:new Date(Date.now()-10800000).toISOString() },
  { _id:'sf-3', name:'王芳', phone:'13722223333', status:'need_help', message:'还在二楼,水到一楼天花板,请通知家人我在等救援', currentLocation:'XX村3组', createdAt:new Date(Date.now()-3600000).toISOString() },
];
const ROAD_STATUS = [
  { _id:'rd-1', roadName:'G72泉南高速南宁段', coordinates:[108.4,22.8], status:'impassable', waterLevel:5, description:'积水深,封闭', updatedAt:new Date(Date.now()-3600000).toISOString() },
  { _id:'rd-2', roadName:'广佛高速', coordinates:[113.1,23.0], status:'passable', waterLevel:0, description:'正常通行', updatedAt:new Date(Date.now()-7200000).toISOString() },
  { _id:'rd-3', roadName:'肇庆大桥引道', coordinates:[112.5,23.05], status:'difficult', waterLevel:2, description:'可慢速通行,大型车慎入', updatedAt:new Date(Date.now()-5400000).toISOString() },
];

app.post('/api/water-levels', (req, res) => {
  WATER_LEVELS.unshift({ _id:'wl-'+Date.now(), ...req.body, observedAt:new Date().toISOString() });
  res.status(201).json(ok({ id:'wl-new', level:req.body.level }, '水位已上报'));
});
app.get('/api/dashboard/water-map', (req, res) => {
  const hours = Number(req.query.hours)||24;
  const since = Date.now() - hours*3600000;
  res.json(ok(WATER_LEVELS.filter(w => new Date(w.observedAt).getTime() > since)));
});
app.get('/api/dashboard/regions', (req, res) => {
  const hours = Number(req.query.hours)||24;
  const since = Date.now() - hours*3600000;
  const recent = WATER_LEVELS.filter(w => new Date(w.observedAt).getTime() > since);
  const m = {};
  for (const w of recent) {
    const k = w.province+w.city+w.district;
    if (!m[k]) m[k] = { _id:{province:w.province,city:w.city,district:w.district}, maxLevel:0, dangerCount:0, total:0, latestAt:w.observedAt };
    m[k].maxLevel = Math.max(m[k].maxLevel, w.level);
    m[k].dangerCount += w.level>=3?1:0;
    m[k].total++;
    if (new Date(w.observedAt) > new Date(m[k].latestAt)) m[k].latestAt = w.observedAt;
  }
  res.json(ok(Object.values(m).sort((a,b)=>b.maxLevel-a.maxLevel)));
});
app.post('/api/safety', (req, res) => {
  SAFETY_REPORTS.unshift({ _id:'sf-'+Date.now(), ...req.body, createdAt:new Date().toISOString() });
  res.status(201).json(ok({ id:'sf-new' }, '已报平安'));
});
app.get('/api/safety/search', (req, res) => {
  let list = SAFETY_REPORTS;
  if (req.query.name) list = list.filter(s => s.name.includes(req.query.name));
  if (req.query.phone) list = list.filter(s => s.phone === req.query.phone);
  res.json(ok(list));
});
app.post('/api/roads', (req, res) => {
  ROAD_STATUS.unshift({ _id:'rd-'+Date.now(), ...req.body, updatedAt:new Date().toISOString() });
  res.status(201).json(ok({ id:'rd-new' }, '道路信息已上报'));
});
app.get('/api/roads', (req, res) => {
  let list = ROAD_STATUS;
  if (req.query.status) list = list.filter(r => r.status === req.query.status);
  res.json(ok(list));
});
app.get('/api/dashboard/overview', (_req, res) => {
  res.json(ok({
    helps: { pending:2, verified:1, transferred:0, inProgress:0, done:1, abnormal:0, active:3 },
    shelters: { count:3, totalCapacity:1700, inmates:1510, occupancy:89 },
    water: { dangerPoints: WATER_LEVELS.filter(w=>w.level>=3).length, total: WATER_LEVELS.length },
  }));
});

// ===== 智能录入(AI 辅助拆解,mock 模拟拆解结果)=====
app.post('/api/intake/parse', (req, res) => {
  const text = (req.body.text || req.body.url || '').toString();
  if (!text.trim()) return res.status(400).json(ok(null, '请提供内容'));

  // mock:模拟 AI 从混杂文本中拆出多条(真实场景由 LLM 完成)
  const lines = text.split(/[\n;；]+|\d+[.、)]/).map(s=>s.trim()).filter(s=>s.length>=4);
  const items = lines.map((line, i) => {
    const phone = (line.match(/1[3-9]\d{9}/)||[])[0] || '';
    const sp = [];
    if (/老人|大爷|大妈|爷爷|奶奶/.test(line)) sp.push('elderly');
    if (/小孩|儿童|孩子|婴儿|宝宝/.test(line)) sp.push('child');
    if (/孕妇|怀孕/.test(line)) sp.push('pregnant');
    if (/急病|受伤|发病|医药/.test(line)) sp.push('patient');
    const urgent = /紧急|危及|生命|快没|撑不住|马上|决堤/.test(line);
    return {
      _tempId: 'tmp-'+Date.now()+'-'+i,
      name: (line.match(/([\u4e00-\u9fa5]{2,4})(?=\s|1[3-9])/)||[])[1] || '',
      phone,
      location: (line.match(/在([\u4e00-\u9fa5a-zA-Z0-9]{2,15}?)(?:,|,|水|车|有|需|请)/)||[])[1] || '',
      summary: line.slice(0, 80),
      urgency: urgent ? 'critical' : (/急|快/.test(line) ? 'high' : 'medium'),
      headcount: 1,
      specialPersons: sp,
      confidence: 0.8,
    };
  });
  res.json(ok({ source: text.slice(0,40), sourceLength: text.length, degraded: false, items }, `AI 拆解出 ${items.length} 条,请核对后入库`));
});
app.post('/api/intake/import', (req, res) => {
  const items = req.body.items || [];
  const created = [];
  const failed = [];
  let seq = 100;
  for (const it of items) {
    seq++;
    const code = `HELP-GX-2026-${String(900+seq).padStart(6,'0')}`;
    helps.unshift({
      _id: code, code, formId: null, formData: null,
      status: 'pending', urgency: it.urgency || 'medium', credibility: 2,
      method: 'intake', reporterRelation: 'other', source: 'intake',
      submittedAt: new Date().toISOString(),
      person: { name: it.name||'', phone: it.phone||'未知', specialPersons: it.specialPersons||[], headcount: it.headcount||1 },
      content: { rawText: it.summary||'', summary: (it.summary||'').slice(0,40), needs: [] },
      location: { coordinates:[], address: it.location||'', raw: it.location||'' },
      ai: { degraded:false }, attachments:[], claimedBy:null, resolved:false, outcome:{}, slaBreached:false,
      hasSpecialPerson: (it.specialPersons||[]).length>0, consent:true, verification:{},
    });
    created.push(code);
  }
  const msg = `成功入库 ${created.length} 条`;
  res.status(201).json(ok({ created, failed }, msg));
});
  if (req.body.username === 'admin' && req.body.password === 'admin123') {
    res.json(ok({ token: 'mock-jwt-token', user: { username:'admin', name:'管理员', role:'admin' } }));
  }
  res.status(401).json(ok(null,'密码错误'));
});
app.get('/api/auth/me', (_req, res) => res.json(ok({ id:'admin', role:'admin' })));
app.get('/api/audit/verify', (_req, res) => res.json(ok({ ok:true, brokenAt:null, reason:null })));

// 上传文件静态访问
app.use('/uploads', express.static('/tmp/rescueflow-uploads'));

const PORT = 3000;
let _n=0; const _paths=[]; app._router.stack.forEach(r=>{ if(r.route){_n++; _paths.push(r.route.path);} }); console.log("[自检]注册路由数:", _n); console.log("[自检]intake 相关:", _paths.filter(p=>p.includes("intake"))); app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  RescueFlow Mock 后端已启动`);
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`  模式: 纯内存演示(无需 MongoDB)`);
  console.log(`  预置 ${helps.length} 条示例求助数据`);
  console.log(`========================================\n`);
});
