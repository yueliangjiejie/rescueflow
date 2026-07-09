<template>
  <div class="app-wrap">
    <van-nav-bar title="我的认领" left-arrow @click-left="$router.back()" />
    <div class="notice">
      这里展示您认领过的求助及对接进度。完成配送后请及时点"已送达/完成",让需求方和平台知道。
    </div>

    <van-empty v-if="!loading && !items.length" description="您还没有认领任何求助">
      <van-button type="primary" size="small" @click="$router.push('/feed')">去互助墙看看</van-button>
    </van-empty>

    <div v-else class="list">
      <van-cell-group v-for="m in items" :key="m.code" inset class="item">
        <van-cell>
          <template #title>
            <div class="head">
              <van-tag :type="statusType(m.status)" size="medium">{{ statusLabel(m.status) }}</van-tag>
              <span v-if="m.isOverdue" class="danger s11">⚠ 超时未响应</span>
              <span class="muted s11" style="margin-left:auto;">{{ fmt(m.requestedAt) }}</span>
            </div>
            <div class="code">需求 {{ m.helpCode }}</div>
            <div v-if="m.offerCode" class="muted s12">供给 {{ m.offerCode }}</div>
            <div v-if="m.note" class="note">"{{ m.note }}"</div>

            <!-- 时间线 -->
            <div class="timeline">
              <span :class="{done: ['accepted','in_transit','delivered','completed'].includes(m.status)}">认领</span>
              <span :class="{done: ['in_transit','delivered','completed'].includes(m.status), cur: m.status==='accepted'}">→ 接受</span>
              <span :class="{done: ['delivered','completed'].includes(m.status), cur: m.status==='in_transit'}">→ 配送</span>
              <span :class="{done: m.status==='completed', cur: m.status==='delivered'}">→ 送达</span>
              <span :class="{done: m.status==='completed'}">→ 完成</span>
            </div>

            <!-- 操作按钮 -->
            <div class="actions" v-if="!['completed','cancelled'].includes(m.status)">
              <van-button v-if="m.status==='requested'" size="small" type="success" @click="adv(m,'accept')">接受</van-button>
              <van-button v-if="m.status==='accepted'" size="small" type="primary" @click="adv(m,'transit')">出发配送</van-button>
              <van-button v-if="['accepted','in_transit'].includes(m.status)" size="small" type="primary" @click="adv(m,'deliver')">已送达</van-button>
              <van-button v-if="!['completed','cancelled'].includes(m.status)" size="small" type="success" @click="adv(m,'complete')">完成</van-button>
              <van-button v-if="!['completed','cancelled'].includes(m.status)" size="small" plain type="danger" @click="adv(m,'cancel')">取消</van-button>
            </div>
          </template>
        </van-cell>
      </van-cell-group>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { showToast } from 'vant';
import { getMatches, advanceMatch } from '../api/help.js';

const items = ref([]);
const loading = ref(true);

const statusLabel = (s) => ({requested:'待响应',accepted:'已接受',in_transit:'配送中',delivered:'已送达',completed:'已完成',cancelled:'已取消'}[s]||s);
const statusType = (s) => ({requested:'warning',accepted:'primary',in_transit:'',delivered:'success',completed:'success',cancelled:'default'}[s]||'default');
const fmt = (t) => t ? new Date(t).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';

async function load() {
  loading.value = true;
  try {
    const myId = localStorage.getItem('rf_uid');
    if (!myId) { items.value = []; return; }
    // 用 fulfillerId 查询我认领的
    const res = await getMatches(myId); // 复用 getMatches,传 myId 当 fulfillerId
    // getMatches 默认按 helpCode 查,这里需要按 fulfillerId
    // 直接调 list 接口
    const r2 = await import('../api/http.js').then(({default: http}) => http.get('/api/matches', { params: { fulfillerId: myId, pageSize: 100 } }));
    items.value = (r2.data.items || []).sort((a,b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  } catch(e) { showToast('加载失败'); }
  finally { loading.value = false; }
}

async function adv(m, action) {
  try {
    const res = await advanceMatch(m.code, action, {});
    m.status = res.data.status;
    showToast('已更新');
    if (['completed','cancelled'].includes(res.data.status)) {
      setTimeout(load, 600);
    }
  } catch(e) { showToast(e.message || '操作失败'); }
}

onMounted(load);
</script>

<style scoped>
.list { padding-bottom: 20px; }
.item { margin-bottom: 8px; }
.head { display:flex; align-items:center; gap:4px; margin-bottom:4px; }
.code { font-weight:600; font-size:14px; }
.note { font-size:13px; color:#646566; margin-top:4px; }
.timeline { display:flex; flex-wrap:wrap; gap:2px; margin:8px 0; font-size:11px; color:#c8c9cc; }
.timeline span.done { color:#07c160; }
.timeline span.cur { color:#1989fa; font-weight:600; }
.actions { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
.s11 { font-size:11px; } .s12 { font-size:12px; }
.muted { color:#969799; } .danger { color:#ee0a24; }
</style>
