<template>
  <div class="app-wrap">
    <van-nav-bar title="信息墙管理" left-arrow @click-left="$router.back()" />

    <van-tabs v-model:active="tab" @change="load">
      <van-tab title="需求" name="needs" />
      <van-tab title="供给" name="offers" />
    </van-tabs>

    <van-search v-model="kw" placeholder="搜索标题/摘要" @search="load" shape="round" />

    <!-- 需求列表 -->
    <div v-if="tab==='needs'" class="list">
      <van-cell-group v-for="h in list" :key="h.code" inset class="item">
        <van-cell>
          <template #title>
            <div class="head">
              <van-tag :type="needStatusType(h.status)" size="medium">{{ needStatusLabel(h.status) }}</van-tag>
              <van-tag v-if="h.urgency==='critical'" type="danger" size="mini">紧急</van-tag>
              <span v-if="h.deletedAt" class="danger s11">已删除</span>
              <span class="muted s11" style="margin-left:auto;">{{ fmt(h.submittedAt) }}</span>
            </div>
            <div class="code">{{ h.code }}</div>
            <div class="summary">{{ h.content?.summary || h.content?.rawText || '(无描述)' }}</div>
            <div class="meta"><van-icon name="location-o" />{{ h.location?.address || h.location?.raw || '位置未填' }}</div>
            <div v-if="h.reviewNote" class="review-note danger">驳回意见：{{ h.reviewNote }}</div>
          </template>
        </van-cell>
        <div class="actions">
          <van-button size="small" plain @click="editNeed(h)">编辑</van-button>
          <van-button v-if="!h.deletedAt" size="small" type="danger" plain @click="delNeed(h)">删除</van-button>
          <van-button v-else size="small" type="success" plain @click="restoreNeed(h)">恢复</van-button>
          <van-button v-if="h.status!=='done'" size="small" type="success" @click="doneNeed(h)">标记完成</van-button>
        </div>
      </van-cell-group>
    </div>

    <!-- 供给列表 -->
    <div v-else class="list">
      <van-cell-group v-for="o in list" :key="o.code" inset class="item">
        <van-cell>
          <template #title>
            <div class="head">
              <van-tag :type="offerStatusType(o.status)" size="medium">{{ offerStatusLabel(o.status) }}</van-tag>
              <van-tag plain size="mini">{{ typeLabel(o.type) }}</van-tag>
              <span class="muted s11" style="margin-left:auto;">{{ fmt(o.submittedAt) }}</span>
            </div>
            <div class="code">{{ o.code }}</div>
            <div class="summary">{{ o.title }}</div>
            <div v-if="o.description" class="desc">{{ o.description }}</div>
            <div class="meta">
              <van-icon name="location-o" />{{ o.location || '位置未填' }}
              <span v-if="o.quantity" style="margin-left:6px;">· {{ o.quantity }}{{ o.unit }}</span>
            </div>
            <div class="meta"><van-icon name="phone-o" />{{ o.provider?.phone || '无电话' }} · {{ o.provider?.name || '匿名' }}</div>
          </template>
        </van-cell>
        <div class="actions">
          <van-button size="small" plain @click="editOffer(o)">编辑</van-button>
          <van-button v-if="o.status!=='removed'" size="small" type="danger" plain @click="delOffer(o)">下架</van-button>
          <van-button v-else size="small" type="success" plain @click="restoreOfferItem(o)">恢复</van-button>
        </div>
      </van-cell-group>
    </div>

    <van-empty v-if="!list.length && !loading" description="暂无数据" />

    <!-- 编辑求助弹窗 -->
    <van-dialog v-model:show="needEditShow" title="编辑需求" show-cancel-button @confirm="saveNeed">
      <div style="padding: 12px 16px;">
        <van-field v-model="needEdit.summary" label="摘要" type="textarea" rows="2" placeholder="需求摘要" />
        <van-field v-model="needEdit.location" label="位置" placeholder="位置" />
      </div>
    </van-dialog>

    <!-- 编辑供给弹窗 -->
    <van-dialog v-model:show="offerEditShow" title="编辑供给" show-cancel-button @confirm="saveOffer">
      <div style="padding: 12px 16px;">
        <van-field v-model="offerEdit.title" label="标题" placeholder="供给标题" />
        <van-field v-model="offerEdit.description" label="描述" type="textarea" rows="2" placeholder="详细描述" />
        <div style="display:flex; gap:8px;">
          <van-field v-model.number="offerEdit.quantity" label="数量" type="digit" style="flex:1;" />
          <van-field v-model="offerEdit.unit" label="单位" style="flex:1;" />
        </div>
        <van-field v-model="offerEdit.location" label="位置" placeholder="位置" />
        <van-cell title="状态">
          <van-radio-group v-model="offerEdit.status" direction="horizontal">
            <van-radio name="available">可用</van-radio>
            <van-radio name="matched">已匹配</van-radio>
            <van-radio name="removed">已下架</van-radio>
          </van-radio-group>
        </van-cell>
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { showToast, showSuccessToast, showConfirmDialog } from 'vant';
import { listHelps, helpAction, deleteHelp, restoreHelp, listAdminOffers, updateOffer, deleteOffer, restoreOffer as restoreOfferApi } from '../api/admin.js';

const tab = ref('needs');
const list = ref([]);
const loading = ref(false);
const kw = ref('');

const typeLabel = (t) => ({ supplies:'物资', transport:'运力', service:'服务', venue:'场地' }[t] || t);
const needStatusLabel = (s) => ({ pending:'待核实', verified:'已核实', in_progress:'处理中', done:'已完成', abnormal:'已驳回', transferred:'已转交' }[s] || s);
const needStatusType = (s) => ({ pending:'warning', verified:'success', in_progress:'', done:'default', abnormal:'danger', transferred:'primary' }[s] || 'default');
const offerStatusLabel = (s) => ({ available:'可用', matched:'已匹配', removed:'已下架' }[s] || s);
const offerStatusType = (s) => ({ available:'success', matched:'warning', removed:'default' }[s] || 'default');
const fmt = (t) => t ? new Date(t).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';

async function load() {
  loading.value = true;
  try {
    if (tab.value === 'needs') {
      const params = { pageSize: 50 };
      if (kw.value) params.q = kw.value;
      const res = await listHelps(params);
      list.value = res.data.items || [];
    } else {
      const res = await listAdminOffers();
      let items = res.data.items || [];
      if (kw.value) {
        const rx = new RegExp(kw.value, 'i');
        items = items.filter(o => rx.test(o.title) || rx.test(o.description || '') || rx.test(o.category || ''));
      }
      list.value = items;
    }
  } catch (e) { showToast(e.message || '加载失败'); }
  finally { loading.value = false; }
}

// ===== 需求操作 =====
const needEditShow = ref(false);
const needEdit = reactive({ code:'', summary:'', location:'' });
function editNeed(h) {
  needEdit.code = h.code;
  needEdit.summary = h.content?.summary || '';
  needEdit.location = h.location?.address || h.location?.raw || '';
  needEditShow.value = true;
}
async function saveNeed() {
  try {
    // mock-server 没有专门的 helps 编辑接口,用 transition + 备注近似;这里展示用 updateOffer 模式
    // 实际需求编辑通过 content/location 更新 — mock 用 reveal 后简单处理
    showSuccessToast('已保存(演示)');
    load();
  } catch (e) { showToast(e.message || '保存失败'); }
}
async function delNeed(h) {
  try {
    await showConfirmDialog({ title:'确认删除', message:`删除 ${h.code}?可恢复` });
    await deleteHelp(h.code);
    showSuccessToast('已删除');
    load();
  } catch (e) { if (e !== 'cancel' && e?.message) showToast(e.message); }
}
async function restoreNeed(h) {
  await restoreHelp(h.code);
  showSuccessToast('已恢复');
  load();
}
async function doneNeed(h) {
  await helpAction(h.code, 'transition', { toStatus: 'done' });
  showSuccessToast('已完成');
  load();
}

// ===== 供给操作 =====
const offerEditShow = ref(false);
const offerEdit = reactive({ code:'', title:'', description:'', quantity:null, unit:'', location:'', status:'available' });
function editOffer(o) {
  Object.assign(offerEdit, { code:o.code, title:o.title, description:o.description||'', quantity:o.quantity, unit:o.unit||'', location:o.location||'', status:o.status });
  offerEditShow.value = true;
}
async function saveOffer() {
  try {
    await updateOffer(offerEdit.code, { title:offerEdit.title, description:offerEdit.description, quantity:offerEdit.quantity, unit:offerEdit.unit, location:offerEdit.location, status:offerEdit.status });
    showSuccessToast('已保存');
    load();
  } catch (e) { showToast(e.message || '保存失败'); }
}
async function delOffer(o) {
  try {
    await showConfirmDialog({ title:'确认下架', message:`下架 ${o.code}?可恢复` });
    await deleteOffer(o.code);
    showSuccessToast('已下架');
    load();
  } catch (e) { if (e !== 'cancel' && e?.message) showToast(e.message); }
}
async function restoreOfferItem(o) {
  await restoreOfferApi(o.code);
  showSuccessToast('已恢复');
  load();
}

onMounted(load);
</script>

<style scoped>
.list { padding-bottom: 20px; }
.item { margin-bottom: 8px; }
.head { display:flex; align-items:center; gap:4px; margin-bottom:4px; flex-wrap:wrap; }
.code { font-size:12px; color:#1989fa; font-weight:600; }
.summary { font-size:14px; color:#323233; margin: 4px 0; line-height:1.5; }
.desc { font-size:13px; color:#646566; margin-top:2px; }
.meta { font-size:12px; color:#969799; margin-top:4px; }
.review-note { font-size:12px; margin-top:6px; padding:4px 8px; background:#fff1f0; border-radius:4px; }
.actions { display:flex; gap:6px; padding: 8px 12px; border-top: 1px dashed #eee; flex-wrap:wrap; }
.s11 { font-size:11px; } .muted { color:#969799; } .danger { color:#ee0a24; }
</style>
