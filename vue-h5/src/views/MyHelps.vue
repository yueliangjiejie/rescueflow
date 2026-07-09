<template>
  <div class="app-wrap">
    <van-nav-bar title="我发布的求助" left-arrow @click-left="$router.back()" />
    <div class="notice">
      这里展示您通过本设备发布的求助记录。提交后状态为"待核实",经志愿者核实后在信息墙公开展示。
    </div>

    <van-empty v-if="!loading && !items.length" description="您还没有发布过求助">
      <van-button type="danger" size="small" @click="$router.push('/register')">去登记求助</van-button>
    </van-empty>

    <div v-else class="list">
      <van-cell-group v-for="(h, idx) in items" :key="h.code + idx" inset class="item">
        <van-cell>
          <template #title>
            <div class="head">
              <van-tag type="danger" size="medium">待核实</van-tag>
              <span class="code">{{ h.code }}</span>
              <span class="muted s11" style="margin-left:auto;">{{ fmt(h.at) }}</span>
            </div>
            <div v-if="h.summary" class="summary">{{ h.summary }}</div>
          </template>
        </van-cell>
      </van-cell-group>
    </div>

    <div v-if="items.length" style="padding: 16px;">
      <van-button block plain type="danger" @click="clear">清空记录</van-button>
      <p class="muted s11" style="text-align:center; margin-top:6px;">仅清除本设备的记录,不影响已提交到平台的数据</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { showToast, showSuccessToast } from 'vant';

const items = ref([]);
const loading = ref(true);
const fmt = (t) => t ? new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

async function load() {
  loading.value = true;
  try {
    items.value = JSON.parse(localStorage.getItem('rf_my_helps') || '[]');
  } catch { items.value = []; }
  finally { loading.value = false; }
}

function clear() {
  localStorage.removeItem('rf_my_helps');
  items.value = [];
  showSuccessToast('已清空');
}

onMounted(load);
</script>

<style scoped>
.list { padding-bottom: 20px; }
.item { margin-bottom: 8px; }
.head { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
.code { font-weight:600; font-size:13px; }
.summary { font-size:13px; color:#646566; margin-top:2px; }
.s11 { font-size:11px; }
.muted { color:#969799; }
</style>
