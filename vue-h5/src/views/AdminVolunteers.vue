<template>
  <div class="app-wrap">
    <van-nav-bar title="志愿者审批" left-arrow @click-left="$router.back()" />

    <van-tabs v-model:active="filter.status" @change="load">
      <van-tab v-for="s in statuses" :key="s.value" :name="s.value" :title="s.label" />
    </van-tabs>

    <div v-if="list.length" class="list">
      <van-cell-group v-for="v in list" :key="v._id" inset class="item">
        <van-cell>
          <template #title>
            <div class="head">
              <van-tag :type="statusType(v.applicationStatus)" size="medium">{{ statusLabel(v.applicationStatus) }}</van-tag>
              <span class="name">{{ v.userId?.name || '未知' }}</span>
            </div>
            <div class="info">
              <van-icon name="phone-o" />{{ v.userId?.phone || '无电话' }}
              <span class="muted s12"> · {{ v.userId?.username }}</span>
            </div>
            <div v-if="v.skills?.length" class="skills">
              <van-tag v-for="s in v.skills" :key="s" plain type="primary" size="mini">{{ s }}</van-tag>
            </div>
            <div v-if="v.serviceArea?.address" class="info">
              <van-icon name="location-o" />{{ v.serviceArea.address }}
            </div>
            <!-- 审核意见展示 -->
            <div v-if="v.approveNote" class="review-note success">✓ 通过意见：{{ v.approveNote }}</div>
            <div v-if="v.rejectReason" class="review-note danger">✗ 驳回理由：{{ v.rejectReason }}</div>
          </template>
        </van-cell>

        <div class="actions" v-if="v.applicationStatus === 0">
          <van-button size="small" type="success" @click="openApprove(v)">通过</van-button>
          <van-button size="small" type="danger" plain @click="openReject(v)">拒绝</van-button>
        </div>
      </van-cell-group>
    </div>
    <van-empty v-else-if="!loading" description="暂无申请" />

    <!-- 通过弹窗 -->
    <van-dialog v-model:show="approveShow" title="审批通过" show-cancel-button :before-close="beforeApproveClose">
      <div style="padding: 12px 16px;">
        <p class="muted s12" style="margin:0 0 8px;">为 {{ approveForm.name }} 填写审批意见</p>
        <van-field v-model="approveForm.note" type="textarea" rows="2" placeholder="如:技能符合要求,欢迎加入" />
      </div>
    </van-dialog>

    <!-- 拒绝弹窗 -->
    <van-dialog v-model:show="rejectShow" title="拒绝申请" show-cancel-button :before-close="beforeRejectClose">
      <div style="padding: 12px 16px;">
        <p class="muted s12" style="margin:0 0 8px;">为 {{ rejectForm.name }} 填写驳回理由(申请人可见)</p>
        <van-field v-model="rejectForm.reason" type="textarea" rows="3" placeholder="如:材料不全/技能不符/暂无需求" />
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { showToast, showSuccessToast } from 'vant';
import { listVolunteerApps, approveVolunteer, rejectVolunteer } from '../api/admin.js';

const list = ref([]);
const loading = ref(false);
const filter = reactive({ status: 0 });

const statuses = [
  { value: 0, label: '待审' },
  { value: 1, label: '已通过' },
  { value: 2, label: '已拒绝' },
];
const statusLabel = (s) => ({ 0:'待审', 1:'已通过', 2:'已拒绝' }[s] ?? s);
const statusType = (s) => ({ 0:'warning', 1:'success', 2:'danger' }[s] || 'default');

async function load() {
  loading.value = true;
  try {
    const res = await listVolunteerApps({ status: filter.status });
    const items = Array.isArray(res.data) ? res.data : (res.data?.items || []);
    list.value = items;
  } catch (e) { showToast(e.message || '加载失败'); }
  finally { loading.value = false; }
}

// 通过弹窗
const approveShow = ref(false);
const approveForm = reactive({ id:'', name:'', note:'' });
function openApprove(v) {
  approveForm.id = v._id;
  approveForm.name = v.userId?.name || '';
  approveForm.note = '';
  approveShow.value = true;
}
async function beforeApproveClose(action) {
  if (action !== 'confirm') return true;
  try {
    await approveVolunteer(approveForm.id, { note: approveForm.note });
    showSuccessToast('已通过');
    approveShow.value = false;
    load();
    return true;
  } catch (e) { showToast(e.message || '操作失败'); return false; }
}

// 拒绝弹窗
const rejectShow = ref(false);
const rejectForm = reactive({ id:'', name:'', reason:'' });
function openReject(v) {
  rejectForm.id = v._id;
  rejectForm.name = v.userId?.name || '';
  rejectForm.reason = '';
  rejectShow.value = true;
}
async function beforeRejectClose(action) {
  if (action !== 'confirm') return true;
  if (!rejectForm.reason.trim()) { showToast('请填写驳回理由'); return false; }
  try {
    await rejectVolunteer(rejectForm.id, { reason: rejectForm.reason });
    showSuccessToast('已拒绝');
    rejectShow.value = false;
    load();
    return true;
  } catch (e) { showToast(e.message || '操作失败'); return false; }
}

onMounted(load);
</script>

<style scoped>
.list { padding-bottom: 20px; }
.item { margin-bottom: 8px; }
.head { display:flex; align-items:center; gap:6px; margin-bottom:6px; }
.name { font-size:15px; font-weight:600; color:#323233; }
.info { font-size:13px; color:#646566; margin-top:4px; }
.skills { display:flex; gap:4px; flex-wrap:wrap; margin-top:4px; }
.review-note { font-size:12px; margin-top:6px; padding:4px 8px; border-radius:4px; line-height:1.5; }
.review-note.success { background:#f6ffed; color:#52c41a; }
.review-note.danger { background:#fff1f0; color:#ee0a24; }
.actions { display:flex; gap:6px; padding: 8px 12px; border-top: 1px dashed #eee; }
.s12 { font-size:12px; } .muted { color:#969799; }
</style>
