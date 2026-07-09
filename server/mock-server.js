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
      assignedVerifier: d.status === 'pending' ? null : 'operator1',
      deletedAt: null,
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
  let list = helps.filter(h => !h.deletedAt); // 排除软删除
  if (req.query.status) list = list.filter(h => h.status === req.query.status);
  if (req.query.urgency) list = list.filter(h => h.urgency === req.query.urgency);
  if (req.query.formId) list = list.filter(h => h.formId === req.query.formId);
  if (req.query.q) {
    const rx = new RegExp(req.query.q, 'i');
    list = list.filter(h => rx.test(h.code) || rx.test(h.person?.name||'') || rx.test(h.person?.phone||'')
      || rx.test(h.content?.summary||'') || rx.test(h.content?.rawText||'')
      || rx.test(h.location?.address||'') || rx.test(h.location?.raw||''));
  }
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

// Help 管理:指派核实人 / 软删除 / 恢复(必须在通配路由前注册)
app.post('/api/admin/helps/:code/assign-verifier', (req,res) => {
  const h = helps.find(x=>x.code===req.params.code);
  if (h) { h.assignedVerifier = req.body.verifier; h.assignedAt = new Date().toISOString(); }
  res.json(ok({code:req.params.code, assignedVerifier:req.body.verifier}));
});
app.post('/api/admin/helps/:code/delete', (req,res) => {
  const h = helps.find(x=>x.code===req.params.code);
  if (h) { h.deletedAt = new Date().toISOString(); }
  res.json(ok({code:req.params.code},'已删除(可恢复)'));
});
app.post('/api/admin/helps/:code/restore', (req,res) => {
  const h = helps.find(x=>x.code===req.params.code);
  if (h) { h.deletedAt = null; }
  res.json(ok({code:req.params.code},'已恢复'));
});
app.get('/api/admin/helps/:code/audit', (req, res) => {
  res.json(ok([
    { seq:1, action:'create', actorId:'public', summary:'登记求助', createdAt: new Date(Date.now()-3600000).toISOString(), hash:'a1b2c3'.padEnd(64,'0') },
  ]));
});
app.get('/api/admin/helps/:code/reveal', (req, res) => {
  const h = helps.find(h => h.code === req.params.code);
  res.json(ok({ phone: h?.person?.phone || '', name: h?.person?.name || '' }));
});
app.get('/api/admin/helps/:code/duplicates', (req, res) => {
  res.json(ok({ suspicious: false, matches: [] }));
});

// 状态流转(简单实现,排除上述专用 action)
app.post('/api/admin/helps/:code/:action', (req, res) => {
  const h = helps.find(h => h.code === req.params.code);
  if (!h) return res.status(404).json(ok(null,'未找到'));
  const action = req.params.action;
  if (action === 'transition') h.status = req.body.toStatus;
  else if (action === 'verify') { h.status = 'verified'; h.credibility = req.body.credibility || 3; h.verifyNote = req.body.note || ''; h.reviewedAt = new Date().toISOString(); }
  else if (action === 'transfer') { h.status = 'transferred'; h.transferredTo = req.body.transferredTo; }
  else if (action === 'abnormal') { h.status = 'abnormal'; h.abnormalReason = req.body.reason || 'rejected'; h.reviewNote = req.body.reviewNote || ''; h.reviewedAt = new Date().toISOString(); }
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

// ===== 统一志愿者运力池(调度引擎用) =====
// 整合 USERS(role:volunteer) + 已批准 VOL_APPS,加坐标/状态/负载
const VOLUNTEERS = [
  { uid: 'vol-chen', name: '陈船长', phone: '13500003001', skills: ['水域救援','车辆驾驶'], status: 'idle', serviceArea: { coordinates: [108.37, 22.82], address: '南宁邕江沿岸' }, completedCount: 12, activeCount: 0, org: '蓝天救援队' },
  { uid: 'vol-wang', name: '王医生', phone: '13500003002', skills: ['医疗急救','心理疏导'], status: 'idle', serviceArea: { coordinates: [108.40, 22.85], address: '南宁青秀区' }, completedCount: 8, activeCount: 0, org: 'XX市人民医院' },
  { uid: 'vol-li', name: '李师傅', phone: '13500003003', skills: ['车辆驾驶','物资搬运'], status: 'idle', serviceArea: { coordinates: [109.42, 24.33], address: '柳州城中区' }, completedCount: 5, activeCount: 0, org: '个人' },
  { uid: 'vol-zhao', name: '赵护士', phone: '13500003004', skills: ['医疗急救','信息核实'], status: 'busy', serviceArea: { coordinates: [108.05, 22.93], address: '南宁江南区' }, completedCount: 15, activeCount: 1, org: 'XX红十字会' },
  { uid: 'vol-sun', name: '孙向导', phone: '13500003005', skills: ['山地搜救','方言翻译'], status: 'idle', serviceArea: { coordinates: [110.18, 25.11], address: '桂林阳朔' }, completedCount: 6, activeCount: 0, org: '公羊救援队' },
  { uid: 'vol-lin', name: '林志愿者', phone: '13500003006', skills: ['物资搬运','车辆驾驶'], status: 'offline', serviceArea: { coordinates: [109.60, 23.30], address: '来宾兴宾区' }, completedCount: 3, activeCount: 0, org: '个人' },
];

// 运力池接口
app.get('/api/volunteers/pool', (req, res) => {
  let pool = VOLUNTEERS.map(v => ({ ...v }));
  if (req.query.status) pool = pool.filter(v => v.status === req.query.status);
  if (req.query.skill) pool = pool.filter(v => v.skills.includes(req.query.skill));
  // 计算实时负载(从 MATCHES 派生)
  pool.forEach(v => {
    v.activeCount = MATCHES.filter(m => m.fulfillerId === v.uid && !['completed','cancelled'].includes(m.status)).length;
    v.status = v.activeCount > 0 ? 'busy' : v.status;
  });
  res.json(ok({ items: pool, total: pool.length, idle: pool.filter(v=>v.status==='idle').length, busy: pool.filter(v=>v.status==='busy').length, offline: pool.filter(v=>v.status==='offline').length }));
});

// 更新志愿者状态
app.put('/api/volunteers/:uid/status', (req, res) => {
  const v = VOLUNTEERS.find(x => x.uid === req.params.uid);
  if (!v) return res.status(404).json(ok(null, '未找到志愿者'));
  v.status = req.body.status || 'idle';
  res.json(ok(v, '状态已更新'));
});

// ===== 智能推荐引擎 =====
// 距离计算(Haversine,km)
function haversineKm(a, b) {
  if (!a || !b || a.length < 2 || b.length < 2) return 9999;
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b[1] - a[1]), dLng = toRad(b[0] - a[0]);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s)) * 10) / 10;
}

// 推荐算法:技能匹配(权重4) + 距离衰减(权重3) + 空闲优先(权重2) + 历史完成度(权重1)
app.get('/api/dispatch/recommend', (req, res) => {
  const help = helps.find(h => h.code === req.query.helpCode);
  if (!help) return res.status(404).json(ok(null, '未找到求助'));
  const helpCoord = help.location?.coordinates || [];
  // 从摘要/需求推断所需技能关键词
  const needText = ((help.content?.summary || '') + ' ' + (help.content?.needs || []).join(' '));
  const SKILL_KEYWORDS = { '医疗急救':['医','伤','病','药','急救','出血'], '水域救援':['水','洪','淹','船','泳','涉水'], '车辆驾驶':['车','运','送','驾','路'], '物资搬运':['搬','扛','物资','搬抬','装卸'], '山地搜救':['山','搜救','迷路','失踪','徒步'], '心理疏导':['心理','恐慌','焦虑','安抚'], '方言翻译':['翻译','方言','语言','听不懂'], '信息核实':['核实','确认','联系','核查'] };
  const neededSkills = [];
  Object.entries(SKILL_KEYWORDS).forEach(([skill, kws]) => { if (kws.some(kw => needText.includes(kw))) neededSkills.push(skill); });

  const recommendations = VOLUNTEERS.filter(v => v.status !== 'offline').map(v => {
    // 技能匹配分(0-4):完全匹配=4,部分=2,无=0
    const matchedSkills = v.skills.filter(s => neededSkills.includes(s));
    const skillScore = neededSkills.length ? (matchedSkills.length / neededSkills.length) * 4 : (matchedSkills.length > 0 ? 2 : 1);
    // 距离分(0-3):50km内满分,每增50km扣0.5
    const distKm = haversineKm(helpCoord, v.serviceArea.coordinates);
    const distScore = Math.max(0, 3 - Math.floor(distKm / 50) * 0.5);
    // 空闲分(0-2)
    const activeCount = MATCHES.filter(m => m.fulfillerId === v.uid && !['completed','cancelled'].includes(m.status)).length;
    const idleScore = activeCount === 0 ? 2 : (activeCount === 1 ? 1 : 0);
    // 历史完成度(0-1)
    const histScore = Math.min(1, v.completedCount / 15);
    const total = Math.round((skillScore + distScore + idleScore + histScore) * 10) / 10;
    const reasons = [];
    if (matchedSkills.length) reasons.push(`技能对口:${matchedSkills.join('/')}`);
    if (distKm < 9999) reasons.push(`距离${distKm}km`);
    reasons.push(activeCount === 0 ? '当前空闲' : `执行中${activeCount}单`);
    if (v.completedCount > 5) reasons.push(`已完成${v.completedCount}次`);
    return { ...v, _matchScore: total, _distKm: distKm, _activeCount: activeCount, _matchedSkills: matchedSkills, _reasons: reasons };
  }).sort((a, b) => b._matchScore - a._matchScore).slice(0, 5);

  res.json(ok({ helpCode: help.code, summary: help.content?.summary, urgency: help.urgency, neededSkills, recommendations }));
});

// 指派:管理员把求助指派给指定志愿者(创建对接)
app.post('/api/dispatch/assign', (req, res) => {
  const { helpCode, volunteerUid, note } = req.body || {};
  const h = helps.find(h => h.code === helpCode);
  const v = VOLUNTEERS.find(x => x.uid === volunteerUid);
  if (!h || !v) return res.status(404).json(ok(null, '求助或志愿者不存在'));
  // 防重复
  const dup = MATCHES.find(m => m.helpCode === helpCode && m.fulfillerId === volunteerUid && !['completed','cancelled'].includes(m.status));
  if (dup) return res.status(409).json(ok(null, '已指派给该志愿者'));
  const m = { _id: 'mt-' + Date.now(), code: 'MATCH-GX-2026-' + String(900 + MATCHES.length).padStart(6, '0'),
    helpCode, offerCode: null, requesterId: '', fulfillerId: v.uid,
    fulfillerName: v.name, fulfillerPhone: v.phone, fulfillerOrg: v.org || '',
    status: 'requested', note: note || `系统指派:管理员调度`, quantity: null,
    requestedAt: new Date().toISOString(), respondDeadline: new Date(Date.now() + 7200000).toISOString(), isOverdue: false };
  MATCHES.unshift(m);
  v.status = 'busy';
  res.status(201).json(ok({ matchCode: m.code, volunteer: v.name, status: 'requested' }, '指派成功,已通知志愿者'));
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
  if (req.body.username === 'admin' && req.body.password === 'admin123') {
    return res.json(ok({ token: 'mock-jwt-token', user: { username:'admin', name:'管理员', role:'admin' } }));
  }
  return res.status(401).json(ok(null,'密码错误'));
});

// 用户/组织/志愿者管理(mock 数据)
const USERS = [
  { _id:'u1', username:'admin', name:'管理员', phone:'13500003001', role:'admin', active:true },
  { _id:'u2', username:'volunteer1', name:'陈船长', phone:'13500002002', role:'volunteer', active:true },
  { _id:'u3', username:'volunteer2', name:'王医生', phone:'13500002003', role:'volunteer', active:true },
  { _id:'u4', username:'operator1', name:'小李', phone:'13500003002', role:'operator', active:true },
];
const ORGS = [
  { _id:'o1', code:'ORG-001', name:'蓝天救援队', type:'rescue_team', contactName:'张队长', contactPhone:'13500002001', contactWechat:'blue-sky-001', address:'南宁市', capabilities:['水域救援','山地搜救'], serviceArea:'广西全区', verified:true, active:true },
  { _id:'o2', code:'ORG-002', name:'公羊救援队', type:'rescue_team', contactName:'李队长', contactPhone:'13500002002', contactWechat:'gy-001', address:'杭州市', capabilities:['水域救援','国际救援'], serviceArea:'全国', verified:true, active:true },
  { _id:'o3', code:'ORG-003', name:'XX市应急管理局', type:'government', contactName:'王主任', contactPhone:'13500002003', address:'XX市', capabilities:[], serviceArea:'XX市', verified:true, active:true },
  { _id:'o4', code:'ORG-004', name:'XX红十字会', type:'ngo', contactName:'刘会长', contactPhone:'13500002004', capabilities:['物资调配','医疗'], serviceArea:'XX市', verified:true, active:true },
];
const VOL_APPS = [
  { _id:'va1', userId:{username:'newvol1', name:'新志愿者小赵', phone:'13500004001'}, skills:['车辆驾驶','物资搬运'], applicationStatus:0, serviceArea:{address:'南宁市'} },
];

// 用户
app.get('/api/users', (req,res) => {
  let list = USERS;
  if (req.query.role) list = list.filter(u=>u.role===req.query.role);
  if (req.query.q) list = list.filter(u=>u.username.includes(req.query.q)||u.name.includes(req.query.q));
  res.json(ok(list));
});
app.post('/api/users', (req,res) => {
  const u = { _id:'u'+Date.now(), username:req.body.username, name:req.body.name||req.body.username, phone:req.body.phone||'', role:req.body.role||'volunteer', active:true };
  USERS.push(u); res.status(201).json(ok(u,'已创建(默认密码 123456)'));
});
app.put('/api/users/:id', (req,res) => {
  const u = USERS.find(x=>x._id===req.params.id);
  if (u) Object.assign(u, {name:req.body.name??u.name, phone:req.body.phone??u.phone, role:req.body.role??u.role, active:req.body.active??u.active});
  res.json(ok(u));
});
app.delete('/api/users/:id', (req,res) => {
  const u = USERS.find(x=>x._id===req.params.id); if (u) u.active=false;
  res.json(ok(u,'已停用'));
});
app.post('/api/users/:id/reset-password', (req,res) => res.json(ok(null,'密码已重置')));

// 组织
app.get('/api/organizations', (req,res) => {
  let list = ORGS.filter(o=>o.active || req.query.activeOnly==='false');
  if (req.query.type) list = list.filter(o=>o.type===req.query.type);
  res.json(ok(list));
});
app.post('/api/organizations', (req,res) => {
  const o = { _id:'o'+Date.now(), code:'ORG-'+Date.now().toString().slice(-4), active:true, verified:false, ...req.body };
  ORGS.push(o); res.status(201).json(ok(o,'组织已创建'));
});
app.put('/api/organizations/:id', (req,res) => {
  const o = ORGS.find(x=>x._id===req.params.id);
  if (o) Object.assign(o, req.body);
  res.json(ok(o));
});
app.delete('/api/organizations/:id', (req,res) => {
  const o = ORGS.find(x=>x._id===req.params.id); if (o) o.active=false;
  res.json(ok(o,'已停用'));
});

// 志愿者审批
app.get('/api/volunteers/applications', (req,res) => {
  let list = VOL_APPS;
  if (req.query.status!=null) list = list.filter(a=>a.applicationStatus===Number(req.query.status));
  res.json(ok(list));
});
app.post('/api/volunteers/:id/approve', (req,res) => {
  const a = VOL_APPS.find(x=>x._id===req.params.id);
  if (a) { a.applicationStatus=1; a.approveNote = req.body?.note || ''; a.reviewedAt = new Date().toISOString(); }
  res.json(ok(a));
});
app.post('/api/volunteers/:id/reject', (req,res) => {
  const a = VOL_APPS.find(x=>x._id===req.params.id);
  if (a) { a.applicationStatus=2; a.rejectReason = req.body?.reason || ''; a.reviewedAt = new Date().toISOString(); }
  res.json(ok(a));
});

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

// ===== 智能录入(AI 辅助拆解,mock 模拟拆解结果 + 性质判定)=====
function classifyKind(line) {
  if (/我有|可捐|可提供|可支援|能帮忙|免费|捐赠|我是.{0,6}(医生|司机|船|志愿者)/.test(line)) return 'offer';
  if (/已安全|报平安|已转移|已到.{0,4}安置|我很好|勿念/.test(line)) return 'safety';
  if (/求助|求救|被困|需转移|急需|需要|缺|断了|没电|没水|急病|受伤/.test(line)) return 'need';
  if (/水位|积水|涨水|决堤|齐.{0,2}(膝|腰|胸|脖)|水淹|水到/.test(line)) return 'water';
  if (/^(好的|收到|谢谢|辛苦|加油)/.test(line)) return 'ignore';
  return 'need';
}

app.post('/api/intake/parse', (req, res) => {
  const text = (req.body.text || req.body.url || '').toString();
  if (!text.trim()) return res.status(400).json(ok(null, '请提供内容'));

  // 新切分:电话锚点 + 末尾聚集判定(与后端 parseBatch 一致)
  const phones = Array.from(new Set((text.match(/1[3-9]\d{9}/g) || [])));
  const items = [];
  const build = (segment) => {
    const kind = classifyKind(segment);
    if (kind === 'ignore') return null;
    const phone = (segment.match(/1[3-9]\d{9}/)||[])[0] || (phones[0]||'');
    const sp = [];
    if (/老人|大爷|大妈/.test(segment)) sp.push('elderly');
    if (/小孩|儿童|孩子/.test(segment)) sp.push('child');
    let type=null, quantity=null, unit='';
    if (kind==='offer') {
      if (/船|冲锋舟|车|皮卡/.test(segment)) type='transport';
      else if (/医生|护士|医疗|急救/.test(segment)) type='service';
      else if (/仓库|厂房|场地/.test(segment)) type='venue';
      else type='supplies';
      const qm = segment.match(/(\d+)\s*(箱|瓶|件|包|床|顶|袋|吨|艘|个)/);
      if (qm) { quantity=Number(qm[1]); unit=qm[2]; }
    }
    return {
      _tempId:'tmp-'+Date.now()+'-'+items.length, kind,
      name: kind==='offer' ? (segment.match(/我(?:是|叫)?([\u4e00-\u9fa5]{2,4})(?=[^族])/)||[])[1]||'' : (segment.match(/(?:联系人?|总协调人|对接[:：])\s*([\u4e00-\u9fa5]{2,4})/)||[])[1]||'',
      phone, location:(segment.match(/在([\u4e00-\u9fa5a-zA-Z0-9]{2,15}?)(?:,|,|有|需|水|可|请|。|!)/)||[])[1]||'',
      summary: segment.slice(0,80),
      urgency: kind==='need' ? (/紧急|危及|生命|快没|撑不住|马上|决堤|急急急/.test(segment)?'critical':/急|快/.test(segment)?'high':'medium') : null,
      headcount: kind==='need'?1:null, specialPersons: kind==='need'?sp:[], type, quantity, unit, confidence:0.8,
    };
  };

  if (phones.length <= 1) {
    // 单电话或无电话 → 整段一条
    const it = build(text);
    if (it) items.push(it);
  } else {
    // 多电话 → 判断是否聚集末尾
    const posArr = []; const re = /1[3-9]\d{9}/g; let mm;
    while((mm=re.exec(text))!==null) posArr.push(mm.index);
    const firstIdx = posArr[0]; const lastEnd = posArr[posArr.length-1]+11; const span = lastEnd-firstIdx;
    const clustered = (firstIdx >= text.length*0.6) || (span<=40) || (span/text.length<0.3);
    if (clustered) {
      const it = build(text);
      if (it) items.push(it);
    } else {
      // 按自然段落切分(每个含电话段落一条)
      const paras = text.split(/\n+/).map(s=>s.trim()).filter(Boolean);
      let cur=[], curPhone=0;
      for (const p of paras) {
        const pp = (p.match(/1[3-9]\d{9}/g)||[]).length;
        if (pp>0 && curPhone>0) {
          if (cur.length) { const it=build(cur.join('\n')); if(it) items.push(it); }
          cur=[p]; curPhone=pp;
        } else { cur.push(p); curPhone+=pp; }
      }
      if (cur.length) { const it=build(cur.join('\n')); if(it) items.push(it); }
    }
  }
  res.json(ok({ source: text.slice(0,40), sourceLength: text.length, degraded: false, items }, `AI 拆解出 ${items.length} 条(已分类),请核对后入库`));
});
app.post('/api/intake/import', (req, res) => {
  const items = req.body.items || [];
  const created = { need: [], offer: [], safety: [], water: [] };
  const failed = [];
  let seq = 100;
  for (const it of items) {
    seq++;
    const kind = it.kind || 'need';
    try {
      if (kind === 'need') {
        const code = `HELP-GX-2026-${String(900+seq).padStart(6,'0')}`;
        helps.unshift({ _id:code, code, formId:null, status:'pending', urgency:it.urgency||'medium', credibility:2,
          method:'intake', reporterRelation:'other', source:'intake', submittedAt:new Date().toISOString(),
          person:{name:it.name||'',phone:it.phone||'未知',specialPersons:it.specialPersons||[],headcount:it.headcount||1},
          content:{rawText:it.summary||'',summary:(it.summary||'').slice(0,40),needs:[]},
          location:{coordinates:[],address:it.location||'',raw:it.location||''}, ai:{degraded:false}, attachments:[],
          claimedBy:null, resolved:false, outcome:{}, slaBreached:false, hasSpecialPerson:(it.specialPersons||[]).length>0, consent:true, verification:{} });
        created.need.push(code);
      } else if (kind === 'offer') {
        const code = 'OFFER-GX-2026-'+String(900+seq).padStart(6,'0');
        OFFERS.unshift({ _id:code, code, type:it.type||'supplies', category:'', title:it.summary||'互助', description:'',
          quantity:it.quantity||null, unit:it.unit||'', provider:{name:it.name||'',phone:it.phone||'',org:''},
          location:it.location||'', canDeliver:false, status:'available', submittedAt:new Date().toISOString() });
        created.offer.push(code);
      } else if (kind === 'safety') {
        const id = 'sf-'+seq;
        SAFETY_REPORTS.unshift({ _id:id, name:it.name||'', phone:it.phone||'', status:'safe', message:it.summary||'', currentLocation:it.location||'', createdAt:new Date().toISOString() });
        created.safety.push(id);
      } else if (kind === 'water') {
        const id = 'wl-'+seq;
        WATER_LEVELS.unshift({ _id:id, location:it.location||'', coordinates:[], level:2, trend:'unknown', description:it.summary||'', observedAt:new Date().toISOString() });
        created.water.push(id);
      }
    } catch(e) { failed.push({summary:it.summary, error:e.message}); }
  }
  const summary = { need:created.need.length, offer:created.offer.length, safety:created.safety.length, water:created.water.length, failed:failed.length };
  res.status(201).json(ok({ created, failed, summary }, `分流入库:求助${summary.need} 援助${summary.offer} 报平安${summary.safety} 水位${summary.water}`));
});
app.get('/api/auth/me', (_req, res) => res.json(ok({ id:'admin', role:'admin' })));

// ===== 互助(供给)+ 公开信息墙 =====
const OFFERS = [
  { _id:'of-1', code:'OFFER-GX-2026-000001', type:'supplies', category:'饮用水', title:'可捐200箱矿泉水', description:'公司库存,全新未拆', quantity:200, unit:'箱',
    provider:{name:'李总', phone:'13500001001', org:'XX商贸公司'}, location:'南宁江南区仓库', coordinates:[108.31,22.75], canDeliver:true, status:'available', submittedAt:new Date(Date.now()-7200000).toISOString() },
  { _id:'of-2', code:'OFFER-GX-2026-000002', type:'transport', category:'船只', title:'有2艘冲锋舟可支援', description:'船主本人可驾驶,熟悉XX水域', quantity:2, unit:'艘',
    provider:{name:'陈船长', phone:'13500001002', org:''}, location:'梧州长洲区', coordinates:[111.28,23.47], canDeliver:false, status:'available', submittedAt:new Date(Date.now()-10800000).toISOString() },
  { _id:'of-3', code:'OFFER-GX-2026-000003', type:'service', category:'医生', title:'急诊医生可支援', description:'三甲医院急诊科,可参与现场救治', quantity:null, unit:'',
    provider:{name:'王医生', phone:'13500001003', org:'XX市人民医院'}, location:'可赴现场', coordinates:[108.37,22.82], canDeliver:true, status:'available', submittedAt:new Date(Date.now()-14400000).toISOString() },
  { _id:'of-4', code:'OFFER-GX-2026-000004', type:'venue', category:'仓库', title:'可提供500平仓库暂存物资', description:'通风干燥,叉车可进', quantity:500, unit:'平米',
    provider:{name:'张经理', phone:'13500001004', org:'XX物流园'}, location:'贵港港北区', coordinates:[109.60,23.10], canDeliver:false, status:'available', submittedAt:new Date(Date.now()-18000000).toISOString() },
];

function maskP(p){ return p && p.length>=7 ? p.slice(0,3)+'****'+p.slice(-4) : p; }

// 信息墙:把 helps(需求) 和 offers(供给) 合流
app.get('/api/feed', (req, res) => {
  const kind = req.query.kind || 'all';
  const sort = req.query.sort || 'latest';
  const cat = req.query.category;
  const W = { critical:4, high:3, medium:2, low:1 };

  let needs = [];
  if (kind === 'all' || kind === 'need') {
    needs = helps.filter(h => !['done','archived','abnormal'].includes(h.status) && !h.deletedAt)
      .filter(h => !cat || (h.content?.summary||'').includes(cat))
      .map(h => {
        // 查这条求助的认领(暴露认领人联系方式,让需求方能联系)
        const claims = MATCHES.filter(m => m.helpCode===h.code && !['completed','cancelled'].includes(m.status))
          .map(m => ({ code:m.code, status:m.status, fulfillerName:m.fulfillerName, fulfillerPhone:m.fulfillerPhone, fulfillerOrg:m.fulfillerOrg, note:m.note }));
        return {
          _kind:'need', code:h.code, type:'need', typeLabel:'求助',
          category:(h.content?.needs||[]).join('/')||'求助',
          title:h.content?.summary||h.content?.rawText||'',
          urgency:h.urgency, location:h.location?.address||h.location?.raw||'',
          phone:maskP(h.person?.phone), name:h.person?.name||'', org:'',
          specialPersons:h.person?.specialPersons||[], resolved:!!h.resolved,
          quantity:null,unit:'',canDeliver:false,description:'',
          claims,
          createdAt:h.submittedAt,
        };
      });
  }
  let offers = [];
  if (kind === 'all' || kind === 'offer') {
    offers = OFFERS.filter(o => ['available','matched'].includes(o.status))
      .filter(o => !cat || o.category.includes(cat) || o.title.includes(cat))
      .map(o => ({
        _kind:'offer', code:o.code, type:o.type, typeLabel:({supplies:'物资',transport:'运力',service:'服务',venue:'场地'}[o.type]),
        category:o.category, title:o.title, description:o.description||'',
        urgency:null, location:o.location,
        phone:maskP(o.provider?.phone), name:o.provider?.name||'', org:o.provider?.org||'',
        quantity:o.quantity, unit:o.unit, canDeliver:!!o.canDeliver,
        resolved:false, specialPersons:[],
        createdAt:o.submittedAt,
      }));
  }

  let merged = [...needs, ...offers];
  if (sort === 'urgent') {
    merged.sort((a,b) => {
      if (!!a.resolved !== !!b.resolved) return a.resolved?1:-1;
      if (a._kind==='need' && b._kind==='need') return (W[b.urgency]||0)-(W[a.urgency]||0);
      if (a._kind!==b._kind) return a._kind==='need'?-1:1;
      return new Date(b.createdAt)-new Date(a.createdAt);
    });
  } else {
    merged.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
  }
  res.json(ok({ items:merged, total:merged.length, page:1, pageSize:50 }));
});

app.post('/api/offers', (req, res) => {
  const o = { _id:'of-'+Date.now(), code:'OFFER-GX-2026-'+String(900+OFFERS.length).padStart(6,'0'),
    ...req.body, provider:{name:req.body.providerName,phone:req.body.providerPhone,org:req.body.providerOrg},
    status:'available', submittedAt:new Date().toISOString() };
  OFFERS.unshift(o);
  res.status(201).json(ok({ code:o.code }, '已发布到互助墙'));
});

app.get('/api/offers', (req, res) => {
  let list = OFFERS.filter(o => ['available','matched'].includes(o.status));
  if (req.query.type) list = list.filter(o => o.type === req.query.type);
  res.json(ok({ items:list, total:list.length, page:1, pageSize:50 }));
});

// 后台:全部供给(含已下架,供管理员管理)
app.get('/api/admin/offers', (req, res) => {
  let list = OFFERS.filter(o => !o._removed);
  if (req.query.type) list = list.filter(o => o.type === req.query.type);
  if (req.query.status) list = list.filter(o => o.status === req.query.status);
  res.json(ok({ items: list.map(o => ({ ...o, provider: { ...o.provider, phone: maskP(o.provider?.phone) } })), total: list.length }));
});

// 后台:编辑供给
app.put('/api/admin/offers/:code', (req, res) => {
  const o = OFFERS.find(x => x.code === req.params.code);
  if (!o) return res.status(404).json(ok(null, '未找到'));
  if (req.body.title != null) o.title = req.body.title;
  if (req.body.description != null) o.description = req.body.description;
  if (req.body.quantity != null) o.quantity = req.body.quantity;
  if (req.body.unit != null) o.unit = req.body.unit;
  if (req.body.category != null) o.category = req.body.category;
  if (req.body.location != null) o.location = req.body.location;
  if (req.body.status != null) o.status = req.body.status;
  if (req.body.canDeliver != null) o.canDeliver = req.body.canDeliver;
  res.json(ok(o, '已更新'));
});

// 后台:删除/下架供给(软删除,可恢复)
app.post('/api/admin/offers/:code/delete', (req, res) => {
  const o = OFFERS.find(x => x.code === req.params.code);
  if (o) { o._removed = true; o.status = 'removed'; }
  res.json(ok({ code: req.params.code }, '已下架'));
});

app.post('/api/admin/offers/:code/restore', (req, res) => {
  const o = OFFERS.find(x => x.code === req.params.code);
  if (o) { o._removed = false; o.status = 'available'; }
  res.json(ok({ code: req.params.code }, '已恢复'));
});

app.get('/api/offers/match', (req, res) => {
  const help = helps.find(h => h.code === req.query.help);
  if (!help) return res.json(ok({ help:null, matches:[] }));
  // 按需求关键词给候选供给打匹配分,排序后返回
  const needText = ((help.content?.summary || '') + ' ' + (help.content?.needs || []).join(' ')).toLowerCase();
  const candidates = OFFERS.filter(o => o.status === 'available').map(o => {
    const offerText = ((o.title || '') + ' ' + (o.category || '') + ' ' + (o.description || '')).toLowerCase();
    let score = 0;
    needText.split(/\s+/).filter(w => w.length >= 2).forEach(w => { if (offerText.includes(w)) score += 10; });
    return { ...o, _matchScore: score, provider: { ...o.provider, phone: maskP(o.provider?.phone) } };
  }).sort((a, b) => b._matchScore - a._matchScore).slice(0, 8);
  res.json(ok({
    help: { code: help.code, summary: help.content?.summary, urgency: help.urgency, needs: help.content?.needs || [] },
    matches: candidates,
  }));
});

// ===== 认领/对接(Match)=====
const MATCHES = [
  { _id:'mt-1', code:'MATCH-GX-2026-000001', helpCode:'HELP-GX-2026-000001', offerCode:'OFFER-GX-2026-000002',
    requesterId:'public-1', fulfillerId:'v-chencaptain', fulfillerName:'陈船长', fulfillerPhone:'13500001002', fulfillerOrg:'个人',
    status:'accepted', note:'2艘冲锋舟已出发前往XX村', quantity:2,
    requestedAt:new Date(Date.now()-7200000).toISOString(), acceptedAt:new Date(Date.now()-3600000).toISOString(),
    respondDeadline:new Date(Date.now()+3600000).toISOString(), isOverdue:false },
  { _id:'mt-3', code:'MATCH-GX-2026-000003', helpCode:'HELP-GX-2026-000001', offerCode:'OFFER-GX-2026-000003',
    requesterId:'public-1', fulfillerId:'v-wangdoctor', fulfillerName:'王医生', fulfillerPhone:'13500001003', fulfillerOrg:'XX市人民医院',
    status:'in_transit', note:'医生赴现场途中', requestedAt:new Date(Date.now()-5400000).toISOString(),
    acceptedAt:new Date(Date.now()-3600000).toISOString(), respondDeadline:new Date(Date.now()+3600000).toISOString(), isOverdue:false },
];

app.post('/api/matches', (req, res) => {
  // 认领人必须留联系方式
  if (!req.body.fulfillerName || !req.body.fulfillerPhone) {
    return res.status(400).json(ok(null, '认领请填写您的姓名和电话,需求方需要联系您'));
  }
  // 防重复:同电话对同需求
  const dup = MATCHES.find(m => m.helpCode===req.body.helpCode && m.fulfillerPhone===req.body.fulfillerPhone && !['completed','cancelled'].includes(m.status));
  if (dup) return res.status(409).json(ok(null, '您已认领过这条,请勿重复'));
  const m = { _id:'mt-'+Date.now(), code:'MATCH-GX-2026-'+String(900+MATCHES.length).padStart(6,'0'),
    helpCode:req.body.helpCode, offerCode:req.body.offerCode||null,
    requesterId:req.body.requesterId||'', fulfillerId:req.body.fulfillerId||'me',
    fulfillerName:req.body.fulfillerName, fulfillerPhone:req.body.fulfillerPhone, fulfillerOrg:req.body.fulfillerOrg||'',
    status:'requested', note:req.body.note||'', quantity:req.body.quantity||null,
    requestedAt:new Date().toISOString(), respondDeadline:new Date(Date.now()+7200000).toISOString(), isOverdue:false };
  MATCHES.unshift(m);
  res.status(201).json(ok({ code:m.code, status:m.status }, '认领成功,需求方会看到您的联系方式'));
});

app.get('/api/matches', (req, res) => {
  let list = MATCHES;
  if (req.query.helpCode) list = list.filter(m => m.helpCode === req.query.helpCode);
  if (req.query.fulfillerId) list = list.filter(m => m.fulfillerId === req.query.fulfillerId);
  if (req.query.status) list = list.filter(m => m.status === req.query.status);
  res.json(ok({ items:list, total:list.length, page:1, pageSize:50 }));
});

// 状态流转(匹配任意 :action)
const TRANS_OK = (action) => (req, res) => {
  const m = MATCHES.find(m => m.code === req.params.code);
  if (!m) return res.status(404).json(ok(null,'对接不存在'));
  const MAP = { accept:'accepted', transit:'in_transit', deliver:'delivered', complete:'completed', cancel:'cancelled' };
  m.status = MAP[action] || m.status;
  if (action==='accept') m.acceptedAt = new Date().toISOString();
  if (action==='deliver') m.deliveredAt = new Date().toISOString();
  if (action==='complete') m.completedAt = new Date().toISOString();
  res.json(ok({ code:m.code, status:m.status }));
};
app.post('/api/matches/:code/accept', TRANS_OK('accept'));
app.post('/api/matches/:code/transit', TRANS_OK('transit'));
app.post('/api/matches/:code/deliver', TRANS_OK('deliver'));
app.post('/api/matches/:code/complete', TRANS_OK('complete'));
app.post('/api/matches/:code/cancel', TRANS_OK('cancel'));

// 供需匹配看板
app.get('/api/dashboard/match', (_req, res) => {
  const activeHelps = helps.filter(h => !['done','archived','abnormal'].includes(h.status));
  const activeOffers = OFFERS.filter(o => ['available','matched'].includes(o.status));
  const activeMatches = MATCHES.filter(m => !['completed','cancelled'].includes(m.status));
  const matchedOfferCodes = new Set(activeMatches.map(m=>m.offerCode).filter(Boolean));
  const idle = activeOffers.filter(o => o.status==='available' && !matchedOfferCodes.has(o.code))
    .map(o => ({ code:o.code, type:o.type, category:o.category, title:o.title, quantity:o.quantity, unit:o.unit, location:o.location }));
  const pendingMatches = activeMatches.filter(m => m.status==='requested')
    .map(m => ({ code:m.code, helpCode:m.helpCode, offerCode:m.offerCode, fulfillerId:m.fulfillerId, isOverdue:m.isOverdue, requestedAt:m.requestedAt }));
  res.json(ok({
    stats: { activeNeeds:activeHelps.length, activeOffers:activeOffers.length, inProgressMatches:activeMatches.length,
             overdue:activeMatches.filter(m=>m.isOverdue).length, gaps:0, idle:idle.length },
    gaps: [{ category:'柴油发电机组', needCount:3 }, { category:'婴儿奶粉', needCount:2 }],
    idle, pendingMatches,
  }));
});
app.get('/api/audit/verify', (_req, res) => res.json(ok({ ok:true, brokenAt:null, reason:null })));

// 上传文件静态访问
app.use('/uploads', express.static('/tmp/rescueflow-uploads'));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  RescueFlow Mock 后端已启动`);
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`  模式: 纯内存演示(无需 MongoDB)`);
  console.log(`  预置 ${helps.length} 条示例求助数据`);
  console.log(`========================================\n`);
});
