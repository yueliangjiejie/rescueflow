<template>
  <div class="app-wrap">
    <van-nav-bar :title="event?.name || '群体事件管理'" left-arrow @click-left="$router.back()" />

    <!-- 顶部统计仪表盘 -->
    <div class="dashboard" v-if="stats">
      <div class="dash-row">
        <div class="dash-cell"><span class="big">{{ stats.total }}</span><span class="lab">总人数</span></div>
        <div class="dash-cell"><span class="big success">{{ stats.byStatus.evacuated + stats.byStatus.safe }}</span><span class="lab">已脱险</span></div>
        <div class="dash-cell"><span class="big danger">{{ stats.byStatus.trapped }}</span><span class="lab">在困</span></div>
        <div class="dash-cell"><span class="big warn">{{ stats.byStatus.missing }}</span><span class="lab">失联</span></div>
      </div>
      <van-progress :percentage="stats.evacRate" color="#07c160" :show-pivot="true" pivot-text="撤离率" />
    </div>

    <!-- 事件详情卡片(群众上报的完整信息) -->
    <van-cell-group inset v-if="event" class="event-info">
      <van-cell title="灾害类型">
        <template #value><van-tag plain size="small">{{ disasterLabel(event.type) }}</van-tag></template>
      </van-cell>
      <van-cell title="地点">
        <template #title>
          <div><van-icon name="location-o" /> {{ event.location?.address || '未填' }}</div>
          <div v-if="event.location?.detail" class="muted s12" style="margin-left:18px;">{{ event.location.detail }}</div>
        </template>
      </van-cell>
      <van-cell title="预估人数" :value="`${event.estimatedCount || 0}人`" />
      <van-cell title="特殊群体" v-if="event.hasSpecialGroups?.length">
        <template #value>
          <van-tag v-for="g in event.hasSpecialGroups" :key="g" type="warning" size="mini" style="margin-left:2px;">{{ g }}</van-tag>
        </template>
      </van-cell>
      <van-cell title="紧急需求" v-if="event.needs?.length">
        <template #value>
          <van-tag v-for="n in event.needs" :key="n" type="danger" size="mini" style="margin-left:2px;">{{ n }}</van-tag>
        </template>
      </van-cell>
      <van-cell title="上报人" v-if="event.contact?.name">
        <template #value>
          {{ event.contact.name }}<span v-if="event.contact.role"> ({{ event.contact.role }})</span>
          <a v-if="event.contact.phone" :href="'tel:'+event.contact.phone" class="call-link" style="margin-left:6px;">{{ event.contact.phone }}</a>
        </template>
      </van-cell>
      <van-cell title="现场情况" v-if="event.scene" :label="event.scene" />
    </van-cell-group>

    <van-tabs v-model:active="tab" shrink sticky>
      <van-tab title="名单" name="roster" />
      <van-tab title="物资" name="dist" :badge="gaps?.totalGaps ? String(gaps.totalGaps) : ''" />
      <van-tab title="责任区" name="zones" />
      <van-tab title="记录" name="logs" />
    </van-tabs>

    <!-- ===== 名单 Tab ===== -->
    <div v-if="tab==='roster'">
      <van-search v-model="rosterFilter.q" placeholder="搜索姓名/电话" @search="loadPersons" shape="round" />
      <div class="filter-tags">
        <van-tag v-for="s in statusFilters" :key="s.value" :type="rosterFilter.status===s.value?'primary':'plain'" round size="medium" @click="rosterFilter.status = rosterFilter.status===s.value?'':s.value; loadPersons()">{{ s.label }}</van-tag>
      </div>
      <div class="list">
        <van-cell-group v-for="p in persons" :key="p._id" inset class="item">
          <van-cell>
            <template #title>
              <div class="head">
                <van-tag :type="pStatusType(p.status)" size="medium">{{ pStatusLabel(p.status) }}</van-tag>
                <span class="person-name">{{ p.name }}</span>
                <van-tag v-if="p.specialTag" type="danger" size="mini">{{ p.specialTag }}</van-tag>
              </div>
              <div class="meta">{{ p.group }}<span v-if="p.phone" style="margin-left:8px;">· <a :href="'tel:'+p.phone" class="call-link">{{ p.phone }}</a></span></div>
              <div v-if="p.checkedAt" class="meta muted">由 {{ p.checkedBy }} 于 {{ fmt(p.checkedAt) }} 确认</div>
              <div v-if="p.notes" class="note-box danger">{{ p.notes }}</div>
            </template>
          </van-cell>
          <div class="actions">
            <van-button v-if="p.status!=='evacuated'" size="mini" type="success" @click="setPersonStatus(p,'evacuated')">标记撤离</van-button>
            <van-button v-if="p.status!=='safe'" size="mini" type="primary" @click="setPersonStatus(p,'safe')">标记脱险</van-button>
            <van-button v-if="p.status!=='missing'" size="mini" plain type="danger" @click="setPersonStatus(p,'missing')">标记失联</van-button>
          </div>
        </van-cell-group>
      </div>
      <van-empty v-if="!persons.length" description="暂无名单" />
    </div>

    <!-- ===== 物资 Tab ===== -->
    <div v-else-if="tab==='dist'">
      <!-- 分配标准 -->
      <div class="section">
        <div class="section-title">分配标准</div>
        <van-cell-group inset>
          <van-cell v-for="s in standards" :key="s._id" :title="s.item">
            <template #value>每人 {{ s.perPerson }} {{ s.unit }}</template>
          </van-cell>
          <van-cell is-link @click="showStdForm = true">
            <template #title><van-icon name="plus" /> 添加标准</template>
          </van-cell>
        </van-cell-group>
      </div>
      <!-- 缺口分析 -->
      <div class="section">
        <div class="section-title">物资缺口分析 <van-tag v-if="gaps" type="danger" size="mini">缺{{ gaps.totalGaps }}项</van-tag></div>
        <div v-if="gaps" class="list">
          <van-cell-group v-for="g in gaps.items" :key="g.group+g.item" inset class="item">
            <van-cell>
              <template #title>
                <div class="head">
                  <van-tag :type="gapTagType(g.status)" size="medium">{{ gapLabel(g.status) }}</van-tag>
                  <span class="person-name">{{ g.group }} · {{ g.item }}</span>
                </div>
                <div class="meta">应发 <b>{{ g.planned }}</b>{{ g.unit || '份' }}（{{ g.groupCount }}人×{{ g.perPerson }}） · 已发 <b class="success">{{ g.distributed }}</b> · <span :class="g.gap>0?'danger':'success'">缺 {{ g.gap }}</span></div>
              </template>
            </van-cell>
          </van-cell-group>
        </div>
      </div>
      <!-- 发放台账 -->
      <div class="section">
        <div class="section-title">发放记录 <van-button size="mini" plain icon="plus" @click="showDistForm = true">记录发放</van-button></div>
        <van-cell-group inset>
          <van-cell v-for="d in distributions" :key="d._id">
            <template #title>
              <div><b>{{ d.group }}</b> · {{ d.item }} <van-tag type="success" size="mini">{{ d.distributedQty }}{{ d.item.slice(-1) }}</van-tag></div>
              <div class="meta muted">{{ d.distributedBy }} · {{ fmt(d.distributedAt) }}</div>
              <div v-if="d.note" class="meta">{{ d.note }}</div>
            </template>
          </van-cell>
        </van-cell-group>
      </div>
    </div>

    <!-- ===== 责任区 Tab ===== -->
    <div v-else-if="tab==='zones'">
      <div class="section">
        <div class="section-title">责任区覆盖 <van-tag v-if="zones" size="mini">确认{{ zones.confirmed }}/{{ zones.total }}</van-tag></div>
        <div v-if="zones" class="list">
          <van-cell-group v-for="z in zones.items" :key="z._id" inset class="item">
            <van-cell>
              <template #title>
                <div class="head">
                  <van-tag :type="zStatusType(z.status)" size="medium">{{ zStatusLabel(z.status) }}</van-tag>
                  <span class="person-name">{{ z.name }}</span>
                </div>
                <div class="meta">负责人: <b>{{ z.leader }}</b> <a v-if="z.leaderPhone" :href="'tel:'+z.leaderPhone" class="call-link">{{ z.leaderPhone }}</a></div>
                <div class="meta">范围:{{ z.scope }} · {{ z.personCount }}人</div>
                <van-progress :percentage="z.totalRooms ? Math.round(z.checkedRooms/z.totalRooms*100) : 0" :color="z.status==='confirmed'?'#07c160':z.status==='checking'?'#ff976a':'#eee'" :show-pivot="true" :pivot-text="`${z.checkedRooms}/${z.totalRooms}间`" />
                <div v-if="z.note" class="note-box">{{ z.note }}</div>
              </template>
            </van-cell>
            <div class="actions">
              <van-button v-if="z.leader==='待指派'" size="mini" type="primary" @click="openAssign(z)">指派负责人</van-button>
              <van-button v-if="z.status!=='confirmed'" size="mini" type="success" @click="openCheck(z)">提交检查</van-button>
            </div>
          </van-cell-group>
        </div>
      </div>
    </div>

    <!-- ===== 记录 Tab ===== -->
    <div v-else-if="tab==='logs'">
      <div class="section">
        <div class="section-title">事件记录时间线 <van-button size="mini" plain icon="edit" @click="showLogForm = true">添加</van-button></div>
        <div class="timeline">
          <div v-for="log in logs" :key="log._id" class="tl-item">
            <div class="tl-dot" :class="log.type"></div>
            <div class="tl-content">
              <div class="tl-meta muted s11">{{ log.author }} · {{ fmt(log.createdAt) }} <van-tag plain size="mini">{{ logTypeLabel(log.type) }}</van-tag></div>
              <div class="tl-text">{{ log.content }}</div>
            </div>
          </div>
        </div>
        <van-empty v-if="!logs.length" description="暂无记录" />
      </div>
    </div>

    <!-- 弹窗:添加分配标准 -->
    <van-dialog v-model:show="showStdForm" title="设定分配标准" show-cancel-button :before-close="beforeStdCreate">
      <div style="padding: 12px 16px;">
        <van-field v-model="stdForm.item" label="物资" placeholder="如:面包/矿泉水/药品" required />
        <div style="display:flex;gap:8px;">
          <van-field v-model.number="stdForm.perPerson" label="每人" type="number" style="flex:2;" />
          <van-field v-model="stdForm.unit" label="单位" placeholder="个/瓶/份" style="flex:1;" />
        </div>
      </div>
    </van-dialog>

    <!-- 弹窗:记录发放 -->
    <van-dialog v-model:show="showDistForm" title="记录物资发放" show-cancel-button :before-close="beforeDistCreate">
      <div style="padding: 12px 16px;">
        <van-field v-model="distForm.group" label="分组" placeholder="如:3栋" required />
        <van-field v-model="distForm.item" label="物资" placeholder="面包/矿泉水" required />
        <van-field v-model.number="distForm.distributedQty" label="数量" type="digit" required />
        <van-field v-model.number="distForm.distributedTo" label="发给人" type="digit" placeholder="人数" />
        <van-field v-model="distForm.note" label="备注" placeholder="可选" />
      </div>
    </van-dialog>

    <!-- 弹窗:提交检查 -->
    <van-dialog v-model:show="showCheckForm" title="提交检查结果" show-cancel-button :before-close="beforeCheck">
      <div style="padding: 12px 16px;">
        <p class="muted s12">{{ checkForm.zoneName }} · 共{{ checkForm.totalRooms }}间</p>
        <van-field v-model.number="checkForm.checkedRooms" label="已检查" type="digit" placeholder="间数" />
        <van-field v-model="checkForm.note" label="备注" placeholder="如:全部确认/发现XX问题" />
      </div>
    </van-dialog>

    <!-- 弹窗:指派负责人 -->
    <van-dialog v-model:show="showAssignForm" title="指派负责人" show-cancel-button :before-close="beforeAssign">
      <div style="padding: 12px 16px;">
        <van-field v-model="assignForm.leader" label="姓名" required />
        <van-field v-model="assignForm.leaderPhone" label="电话" type="tel" />
      </div>
    </van-dialog>

    <!-- 弹窗:添加记录 -->
    <van-dialog v-model:show="showLogForm" title="添加记录" show-cancel-button :before-close="beforeLogCreate">
      <div style="padding: 12px 16px;">
        <van-field v-model="logForm.content" type="textarea" rows="3" placeholder="记录现场情况/进展/问题..." required />
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { showToast, showSuccessToast } from 'vant';
import {
  listRosterEvents, getRosterEvent, listRosterPersons, updatePersonStatus, getRosterStats,
  listDistStandards, createDistStandard, listDistributions, createDistribution, getDistributionGaps,
  listZones, checkZone, assignZoneLeader,
  listEventLogs, createEventLog,
} from '../api/admin.js';

const route = useRoute();
const eventId = route.params.id;
const tab = ref('roster');

const event = ref(null);
const stats = ref(null);
// 名单
const persons = ref([]);
const rosterFilter = reactive({ status: '', q: '' });
// 物资
const standards = ref([]);
const gaps = ref(null);
const distributions = ref([]);
// 责任区
const zones = ref(null);
// 记录
const logs = ref([]);

const pStatusLabel = (s) => ({ trapped:'在困', evacuated:'已撤离', safe:'已脱险', missing:'失联' }[s] || s);
const pStatusType = (s) => ({ trapped:'danger', evacuated:'primary', safe:'success', missing:'warning' }[s] || 'default');
const statusFilters = [
  { value:'trapped', label:'在困' }, { value:'evacuated', label:'已撤离' }, { value:'safe', label:'已脱险' }, { value:'missing', label:'失联' },
];
const gapLabel = (s) => ({ fulfilled:'已满足', partial:'部分发放', pending:'未发放' }[s] || s);
const gapTagType = (s) => ({ fulfilled:'success', partial:'warning', pending:'danger' }[s] || 'default');
const zStatusLabel = (s) => ({ confirmed:'已确认', checking:'检查中', pending:'待检查' }[s] || s);
const zStatusType = (s) => ({ confirmed:'success', checking:'warning', pending:'danger' }[s] || 'default');
const logTypeLabel = (t) => ({ text:'文字', photo:'照片', note:'备注' }[t] || t);
const disasterLabel = (t) => ({ flood:'洪水', earthquake:'地震', fire:'火灾', landslide:'滑坡', typhoon:'台风', other:'其他' }[t] || t || '未知');
const fmt = (t) => t ? new Date(t).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';

async function loadAll() {
  try {
    const [ev, st] = await Promise.all([getRosterEvent(eventId), getRosterStats(eventId)]);
    event.value = ev.data;
    stats.value = st.data;
  } catch (e) { showToast(e.message || '加载失败'); }
  loadPersons();
}

async function loadPersons() {
  try {
    const params = {};
    if (rosterFilter.status) params.status = rosterFilter.status;
    if (rosterFilter.q) params.q = rosterFilter.q;
    const res = await listRosterPersons(eventId, params);
    persons.value = res.data.items || [];
  } catch (e) { showToast(e.message || '加载失败'); }
}

async function setPersonStatus(p, status) {
  try {
    await updatePersonStatus(p._id, { status, checkedBy: '管理员' });
    showSuccessToast('已更新');
    p.status = status;
    // 刷新统计
    const st = await getRosterStats(eventId);
    stats.value = st.data;
  } catch (e) { showToast(e.message || '更新失败'); }
}

// 物资
async function loadDist() {
  try {
    const [std, dist, gap] = await Promise.all([listDistStandards(eventId), listDistributions(eventId), getDistributionGaps(eventId)]);
    standards.value = std.data || [];
    distributions.value = dist.data.items || [];
    gaps.value = gap.data;
  } catch (e) { showToast(e.message || '加载失败'); }
}
const showStdForm = ref(false);
const stdForm = reactive({ item:'', perPerson:1, unit:'个' });
async function beforeStdCreate(action) {
  if (action !== 'confirm') return true;
  if (!stdForm.item.trim()) { showToast('请填写物资'); return false; }
  try { await createDistStandard({ eventId, item:stdForm.item, perPerson:stdForm.perPerson, unit:stdForm.unit }); showSuccessToast('已设定'); loadDist(); return true; }
  catch (e) { showToast(e.message || '失败'); return false; }
}
const showDistForm = ref(false);
const distForm = reactive({ group:'', item:'', distributedQty:0, distributedTo:0, note:'' });
async function beforeDistCreate(action) {
  if (action !== 'confirm') return true;
  if (!distForm.group.trim() || !distForm.item.trim()) { showToast('请填分组和物资'); return false; }
  try { await createDistribution({ eventId, ...distForm }); showSuccessToast('已记录'); Object.assign(distForm, { group:'', item:'', distributedQty:0, distributedTo:0, note:'' }); loadDist(); return true; }
  catch (e) { showToast(e.message || '失败'); return false; }
}

// 责任区
async function loadZones() {
  try { zones.value = (await listZones(eventId)).data; }
  catch (e) { showToast(e.message || '加载失败'); }
}
const showCheckForm = ref(false);
const checkForm = reactive({ zoneId:'', zoneName:'', totalRooms:0, checkedRooms:0, note:'' });
function openCheck(z) { Object.assign(checkForm, { zoneId:z._id, zoneName:z.name, totalRooms:z.totalRooms, checkedRooms:z.checkedRooms, note:'' }); showCheckForm.value = true; }
async function beforeCheck(action) {
  if (action !== 'confirm') return true;
  try { await checkZone(checkForm.zoneId, { checkedRooms:checkForm.checkedRooms, note:checkForm.note }); showSuccessToast('已提交'); loadZones(); return true; }
  catch (e) { showToast(e.message || '失败'); return false; }
}
const showAssignForm = ref(false);
const assignForm = reactive({ zoneId:'', leader:'', leaderPhone:'' });
function openAssign(z) { Object.assign(assignForm, { zoneId:z._id, leader:'', leaderPhone:'' }); showAssignForm.value = true; }
async function beforeAssign(action) {
  if (action !== 'confirm') return true;
  if (!assignForm.leader.trim()) { showToast('请填姓名'); return false; }
  try { await assignZoneLeader(assignForm.zoneId, { leader:assignForm.leader, leaderPhone:assignForm.leaderPhone }); showSuccessToast('已指派'); loadZones(); return true; }
  catch (e) { showToast(e.message || '失败'); return false; }
}

// 记录
async function loadLogs() {
  try { logs.value = (await listEventLogs(eventId)).data.items || []; }
  catch (e) { showToast(e.message || '加载失败'); }
}
const showLogForm = ref(false);
const logForm = reactive({ content:'' });
async function beforeLogCreate(action) {
  if (action !== 'confirm') return true;
  if (!logForm.content.trim()) { showToast('请填写内容'); return false; }
  try { await createEventLog({ eventId, type:'text', content:logForm.content }); showSuccessToast('已添加'); logForm.content=''; loadLogs(); return true; }
  catch (e) { showToast(e.message || '失败'); return false; }
}

// Tab 切换时懒加载
watch(tab, (v) => {
  if (v === 'dist' && !standards.value.length) loadDist();
  if (v === 'zones' && !zones.value) loadZones();
  if (v === 'logs' && !logs.value.length) loadLogs();
});

onMounted(loadAll);
</script>

<style scoped>
.dashboard { background:#fff; padding:12px; border-bottom:1px solid #f0f0f0; }
.event-info { margin: 8px 12px; }
.dash-row { display:flex; gap:4px; margin-bottom:8px; }
.dash-cell { flex:1; text-align:center; }
.big { font-size:24px; font-weight:700; display:block; color:#323233; }
.big.success { color:#07c160; } .big.danger { color:#ee0a24; } .big.warn { color:#ff976a; }
.lab { font-size:11px; color:#969799; }

.filter-tags { display:flex; gap:6px; padding:8px 12px; overflow-x:auto; }
.list { padding-bottom:20px; }
.item { margin: 6px 8px; }
.head { display:flex; align-items:center; gap:4px; margin-bottom:4px; flex-wrap:wrap; }
.person-name { font-size:15px; font-weight:600; }
.meta { font-size:12px; color:#969799; margin-top:3px; }
.call-link { color:#1989fa; text-decoration:none; }
.note-box { font-size:12px; margin-top:4px; padding:4px 8px; background:#fff1f0; border-radius:4px; color:#ee0a24; }
.actions { display:flex; gap:4px; padding:6px 12px; border-top:1px dashed #eee; flex-wrap:wrap; }

.section { padding:8px 12px; }
.section-title { font-size:14px; font-weight:600; margin:8px 0; color:#323233; display:flex; align-items:center; gap:4px; }
.success { color:#07c160; } .danger { color:#ee0a24; }

/* 时间线 */
.timeline { padding:8px 12px; }
.tl-item { display:flex; gap:10px; padding:8px 0; border-bottom:1px solid #f5f5f5; }
.tl-dot { width:10px; height:10px; border-radius:50%; background:#1989fa; flex-shrink:0; margin-top:4px; }
.tl-dot.photo { background:#07c160; } .tl-dot.note { background:#ff976a; }
.tl-content { flex:1; }
.tl-meta { margin-bottom:4px; }
.tl-text { font-size:14px; color:#323233; line-height:1.5; }
.s11 { font-size:11px; } .s12 { font-size:12px; } .muted { color:#969799; }
</style>
