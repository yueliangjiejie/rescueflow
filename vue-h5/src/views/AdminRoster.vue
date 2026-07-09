<template>
  <div class="app-wrap">
    <van-nav-bar title="群体应急管理" left-arrow @click-left="$router.push('/admin')" />

    <div class="intro">
      <van-icon name="info-o" color="#1989fa" size="20" />
      <span>管理群众端上报的群体事件。<b>待介入</b>的事件需确认信息后启动协调,<b>进行中</b>的可管理名单/物资/责任区。</span>
    </div>

    <!-- 状态筛选 -->
    <van-tabs v-model:active="statusFilter" @change="load">
      <van-tab title="待介入" name="reported" />
      <van-tab title="进行中" name="active" />
      <van-tab title="已解决" name="resolved" />
      <van-tab title="全部" name="" />
    </van-tabs>

    <van-pull-refresh v-model="loading" @refresh="load">
      <van-cell-group v-for="ev in events" :key="ev._id" inset class="event-card">
        <van-cell>
          <template #title>
            <div class="ev-head">
              <van-tag :type="statusType(ev.status)" size="medium">{{ statusLabel(ev.status) }}</van-tag>
              <van-tag v-if="ev.urgency==='critical'" type="danger" size="mini">紧急</van-tag>
              <span class="ev-name">{{ ev.name }}</span>
            </div>
            <div class="ev-scene muted s12">{{ ev.scene || ev.type }}</div>
            <div class="ev-meta s12">
              <van-icon name="location-o" />{{ ev.location?.address || '位置未填' }}
              <span v-if="ev.location?.detail"> · {{ ev.location.detail }}</span>
            </div>
            <div class="ev-meta s12">
              <van-icon name="friends-o" />预估{{ ev.estimatedCount || ev.totalRegistered }}人 · {{ groupLabel(ev.groupType) }}
              <span v-if="ev.contact?.name" style="margin-left:6px;">· 上报:{{ ev.contact.name }} <a v-if="ev.contact.phone" :href="'tel:'+ev.contact.phone" class="call-link">{{ ev.contact.phone }}</a></span>
            </div>
            <div v-if="ev.needs?.length" class="ev-meta s12">
              <van-tag v-for="n in ev.needs.slice(0,4)" :key="n" plain type="danger" size="mini">{{ n }}</van-tag>
            </div>
            <div class="ev-stats">
              <div class="stat"><span class="num">{{ ev.totalRegistered }}</span><span class="lab">总人数</span></div>
              <div class="stat"><span class="num success">{{ ev.totalEvacuated }}</span><span class="lab">已撤离</span></div>
              <div class="stat"><span class="num danger">{{ ev.totalTrapped }}</span><span class="lab">在困</span></div>
              <div class="stat"><span class="num warn">{{ ev.totalMissing }}</span><span class="lab">失联</span></div>
            </div>
            <van-progress v-if="ev.totalRegistered" :percentage="Math.round(ev.totalEvacuated/ev.totalRegistered*100)" color="#07c160" track-color="#eee" :show-pivot="true" pivot-text="撤离率" />
          </template>
        </van-cell>
        <!-- 管理操作 -->
        <div class="mgmt-actions">
          <van-button v-if="ev.status==='reported'" size="small" type="danger" @click="intervene(ev)">介入协调</van-button>
          <van-button v-if="ev.status!=='reported'" size="small" type="primary" @click="goEvent(ev)">进入管理</van-button>
          <van-button size="small" plain @click="editEvent(ev)">编辑</van-button>
          <van-button v-if="ev.status==='active'" size="small" plain type="success" @click="resolve(ev)">标记解决</van-button>
          <van-button size="small" plain type="danger" @click="delEvent(ev)">删除</van-button>
        </div>
      </van-cell-group>
    </van-pull-refresh>

    <van-empty v-if="!events.length && !loading" description="暂无事件" />

    <!-- 编辑弹窗 -->
    <van-dialog v-model:show="editShow" title="编辑事件信息" show-cancel-button :before-close="beforeEdit" confirm-button-text="保存">
      <div style="padding: 12px 16px; max-height: 60vh; overflow-y:auto;">
        <van-field v-model="editForm.name" label="名称" required />
        <van-field label="类型">
          <template #input>
            <select v-model="editForm.type" class="sel">
              <option v-for="t in DISASTER_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </template>
        </van-field>
        <van-field label="紧急度">
          <template #input>
            <van-radio-group v-model="editForm.urgency" direction="horizontal">
              <van-radio name="critical">紧急</van-radio><van-radio name="high">紧迫</van-radio><van-radio name="medium">一般</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <van-field v-model="editForm.scene" label="现场情况" type="textarea" rows="2" />
        <van-field v-model="editForm.address" label="地址" />
        <van-field v-model="editForm.locationDetail" label="详细位置" />
        <van-field v-model.number="editForm.estimatedCount" label="预估人数" type="digit" />
        <van-field v-model="editForm.contactName" label="联系人" />
        <van-field v-model="editForm.contactPhone" label="联系电话" type="tel" />
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast, showSuccessToast, showConfirmDialog } from 'vant';
import { listRosterEvents, updateRosterEvent, setRosterEventStatus, deleteRosterEvent } from '../api/admin.js';

const router = useRouter();
const events = ref([]);
const loading = ref(false);
const statusFilter = ref('reported');

const DISASTER_TYPES = [
  { value:'flood', label:'洪水' }, { value:'earthquake', label:'地震' },
  { value:'fire', label:'火灾' }, { value:'landslide', label:'滑坡' },
  { value:'typhoon', label:'台风' }, { value:'other', label:'其他' },
];

const statusLabel = (s) => ({ reported:'待介入', active:'进行中', resolved:'已解决' }[s] || s);
const statusType = (s) => ({ reported:'warning', active:'danger', resolved:'success' }[s] || 'default');
const groupLabel = (g) => ({ school:'学校', community:'社区', factory:'工厂', hospital:'医院', village:'村庄', other:'其他' }[g] || g || '');

async function load() {
  loading.value = true;
  try {
    const params = statusFilter.value ? { status: statusFilter.value } : {};
    const res = await listRosterEvents(params);
    events.value = res.data.items || [];
  } catch (e) { showToast(e.message || '加载失败'); }
  finally { loading.value = false; }
}

function goEvent(ev) { router.push(`/admin/roster/${ev._id}`); }

async function intervene(ev) {
  try {
    await showConfirmDialog({ title: '介入协调', message: `确认介入「${ev.name}」？将启动群体应急协调流程。` });
    await setRosterEventStatus(ev._id, 'active');
    showSuccessToast('已介入');
    ev.status = 'active';
    goEvent(ev);
  } catch (e) { if (e !== 'cancel' && e?.message) showToast(e.message); }
}

async function resolve(ev) {
  try {
    await showConfirmDialog({ title: '标记解决', message: `确认「${ev.name}」已解决？` });
    await setRosterEventStatus(ev._id, 'resolved');
    showSuccessToast('已标记解决');
    ev.status = 'resolved';
  } catch (e) { if (e !== 'cancel' && e?.message) showToast(e.message); }
}

async function delEvent(ev) {
  try {
    await showConfirmDialog({ title: '确认删除', message: `删除「${ev.name}」？关联的名单/物资/责任区数据也会清除,不可恢复。` });
    await deleteRosterEvent(ev._id);
    showSuccessToast('已删除');
    load();
  } catch (e) { if (e !== 'cancel' && e?.message) showToast(e.message); }
}

// 编辑
const editShow = ref(false);
const editForm = reactive({ id:'', name:'', type:'flood', urgency:'high', scene:'', address:'', locationDetail:'', estimatedCount:0, contactName:'', contactPhone:'' });
function editEvent(ev) {
  Object.assign(editForm, {
    id: ev._id, name: ev.name, type: ev.type||'flood', urgency: ev.urgency||'high', scene: ev.scene||'',
    address: ev.location?.address||'', locationDetail: ev.location?.detail||'',
    estimatedCount: ev.estimatedCount||0, contactName: ev.contact?.name||'', contactPhone: ev.contact?.phone||'',
  });
  editShow.value = true;
}
async function beforeEdit(action) {
  if (action !== 'confirm') return true;
  if (!editForm.name.trim()) { showToast('请填写名称'); return false; }
  try {
    await updateRosterEvent(editForm.id, {
      name: editForm.name, type: editForm.type, urgency: editForm.urgency, scene: editForm.scene,
      address: editForm.address, locationDetail: editForm.locationDetail, estimatedCount: editForm.estimatedCount,
      contactName: editForm.contactName, contactPhone: editForm.contactPhone,
    });
    showSuccessToast('已保存');
    editShow.value = false;
    load();
    return true;
  } catch (e) { showToast(e.message || '保存失败'); return false; }
}

onMounted(load);
</script>

<style scoped>
.intro { display:flex; gap:6px; padding:10px 12px; background:#e6f7ff; font-size:12px; color:#0958a8; align-items:flex-start; }
.event-card { margin-bottom: 8px; }
.ev-head { display:flex; align-items:center; gap:4px; margin-bottom:4px; flex-wrap:wrap; }
.ev-name { font-size:16px; font-weight:600; color:#323233; }
.ev-scene { margin-bottom:4px; line-height:1.4; }
.ev-meta { color:#969799; margin-top:3px; }
.ev-stats { display:flex; gap:4px; margin:8px 0; }
.stat { flex:1; text-align:center; background:#f7f8fa; border-radius:6px; padding:6px 2px; }
.num { font-size:18px; font-weight:700; display:block; color:#323233; }
.num.success { color:#07c160; } .num.danger { color:#ee0a24; } .num.warn { color:#ff976a; }
.lab { font-size:10px; color:#969799; }
.mgmt-actions { display:flex; gap:6px; padding:8px 12px; border-top:1px dashed #eee; flex-wrap:wrap; }
.call-link { color:#1989fa; text-decoration:none; }
.sel { border:1px solid #dcdee0; border-radius:4px; padding:4px 8px; font-size:14px; width:100%; }
.s12 { font-size:12px; } .muted { color:#969799; }
</style>
