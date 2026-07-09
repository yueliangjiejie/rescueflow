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
          </template>
        </van-cell>

        <div class="actions" v-if="v.applicationStatus === 0">
          <van-button size="small" type="success" :loading="v._acting === 'approve'" @click="approve(v)">通过</van-button>
          <van-button size="small" type="danger" plain :loading="v._acting === 'reject'" @click="reject(v)">拒绝</van-button>
        </div>
      </van-cell-group>
    </div>
    <van-empty v-else-if="!loading" description="暂无申请" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { showToast, showSuccessToast } from 'vant';
import { listVolunteerApps, approveVolunteer, rejectVolunteer } from '../api/admin.js';

const list = ref([]);
const loading = ref(false);
const filter = reactive({ status: 0 }); // 0=待审

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
    list.value = items.map(v => ({ ...v, _acting: false }));
  } catch (e) { showToast(e.message || '加载失败'); }
  finally { loading.value = false; }
}

async function approve(v) {
  v._acting = 'approve';
  try {
    await approveVolunteer(v._id);
    showSuccessToast('已通过');
    load();
  } catch (e) { showToast(e.message || '操作失败'); }
  finally { v._acting = false; }
}

async function reject(v) {
  v._acting = 'reject';
  try {
    await rejectVolunteer(v._id);
    showSuccessToast('已拒绝');
    load();
  } catch (e) { showToast(e.message || '操作失败'); }
  finally { v._acting = false; }
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
.actions { display:flex; gap:6px; padding: 8px 12px; border-top: 1px dashed #eee; }
.s12 { font-size:12px; } .muted { color:#969799; }
</style>
