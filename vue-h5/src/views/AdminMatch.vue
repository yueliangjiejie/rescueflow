<template>
  <div class="app-wrap">
    <van-nav-bar title="供需对接" left-arrow @click-left="$router.back()" />

    <!-- 统计 -->
    <div class="stats" v-if="d.stats">
      <div class="stat"><div class="num danger">{{ d.stats.activeNeeds }}</div><div class="lab">活跃需求</div></div>
      <div class="stat"><div class="num success">{{ d.stats.activeOffers }}</div><div class="lab">可用供给</div></div>
      <div class="stat"><div class="num primary">{{ d.stats.inProgressMatches }}</div><div class="lab">对接中</div></div>
      <div class="stat"><div class="num" :class="{danger: d.stats.overdue>0}">{{ d.stats.overdue }}</div><div class="lab">超时</div></div>
    </div>

    <!-- 缺口 -->
    <div class="section">
      <div class="section-title">⚠ 缺口（有需求、无对应供给）</div>
      <van-cell-group inset v-if="d.gaps?.length">
        <van-cell v-for="g in d.gaps" :key="g.category" :title="g.category">
          <template #value>
            <van-tag type="danger" size="medium">{{ g.needCount }}人需要</van-tag>
          </template>
        </van-cell>
      </van-cell-group>
      <van-empty v-else image-size="60" description="暂无缺口" />
    </div>

    <!-- 闲置供给 -->
    <div class="section">
      <div class="section-title">💤 闲置供给（无人认领）</div>
      <van-cell-group inset v-if="d.idle?.length">
        <van-cell v-for="o in d.idle" :key="o.code">
          <template #title>
            <div><van-tag :type="typeTag(o.type)" size="mini">{{ typeLabel(o.type) }}</van-tag> <b>{{ o.title }}</b></div>
            <div class="muted s12">{{ o.location }}<span v-if="o.quantity"> · {{ o.quantity }}{{ o.unit }}</span></div>
          </template>
        </van-cell>
      </van-cell-group>
      <van-empty v-else image-size="60" description="暂无闲置" />
    </div>

    <!-- 进行中对接 -->
    <div class="section">
      <div class="section-title">
        进行中对接（{{ ongoing.length }}）
        <van-button size="mini" plain @click="load" style="float:right;">刷新</van-button>
      </div>
      <div v-if="ongoing.length" class="list">
        <van-cell-group v-for="m in ongoing" :key="m.code" inset class="item">
          <van-cell>
            <template #title>
              <div class="head">
                <van-tag :type="mStatusType(m.status)" size="medium">{{ mStatusLabel(m.status) }}</van-tag>
                <span v-if="m.isOverdue" class="danger s11">⚠超时</span>
                <span class="muted s11" style="margin-left:auto;">{{ fmt(m.requestedAt) }}</span>
              </div>
              <div class="code">需求 {{ m.helpCode }}</div>
              <div v-if="m.offerCode" class="muted s12">供给 {{ m.offerCode }}</div>
              <div class="muted s12">认领人 {{ m.fulfillerName || m.fulfillerId || '?' }} <span v-if="m.fulfillerPhone">· {{ m.fulfillerPhone }}</span></div>

              <div class="actions">
                <van-button v-if="m.status==='requested'" size="small" type="success" @click="adv(m,'accept')">接受</van-button>
                <van-button v-if="['accepted','requested'].includes(m.status)" size="small" type="primary" @click="adv(m,'transit')">配送</van-button>
                <van-button v-if="['accepted','in_transit'].includes(m.status)" size="small" type="primary" @click="adv(m,'deliver')">送达</van-button>
                <van-button v-if="!['completed','cancelled'].includes(m.status)" size="small" type="success" @click="adv(m,'complete')">完成</van-button>
                <van-button v-if="!['completed','cancelled'].includes(m.status)" size="small" plain type="danger" @click="adv(m,'cancel')">取消</van-button>
              </div>
            </template>
          </van-cell>
        </van-cell-group>
      </div>
      <van-empty v-else image-size="60" description="暂无进行中对接" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { showToast, showSuccessToast } from 'vant';
import { getMatchDashboard, listMatches, acceptMatch, markTransit, markDelivered, completeMatch, cancelMatch } from '../api/admin.js';

const d = reactive({ stats: {}, gaps: [], idle: [], pendingMatches: [] });
const ongoing = ref([]);
const loading = ref(false);

const typeLabel = (t) => ({ supplies:'物资', transport:'运力', service:'服务', venue:'场地' }[t] || t);
const typeTag = (t) => ({ supplies:'success', transport:'warning', service:'primary', venue:'' }[t] || '');
const mStatusLabel = (s) => ({ requested:'待响应', accepted:'已接受', in_transit:'配送中', delivered:'已送达', completed:'已完成', cancelled:'已取消' }[s] || s);
const mStatusType = (s) => ({ requested:'warning', accepted:'primary', in_transit:'', delivered:'success', completed:'success', cancelled:'default' }[s] || 'default');
const fmt = (t) => t ? new Date(t).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';

const ACTIONS = { accept:acceptMatch, transit:markTransit, deliver:markDelivered, complete:completeMatch, cancel:cancelMatch };

async function load() {
  loading.value = true;
  try {
    const [db, mg] = await Promise.all([getMatchDashboard(), listMatches({ pageSize: 100 })]);
    Object.assign(d, db.data);
    ongoing.value = (mg.data.items || []).filter(m => !['completed','cancelled'].includes(m.status));
  } catch (e) { showToast(e.message || '加载失败'); }
  finally { loading.value = false; }
}

async function adv(m, action) {
  try {
    await ACTIONS[action](m.code);
    showSuccessToast('已更新');
    load();
  } catch (e) { showToast(e.message || '操作失败'); }
}

onMounted(load);
</script>

<style scoped>
.stats { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; padding:12px; }
.stat { background:#fff; border-radius:8px; padding:10px 4px; text-align:center; }
.num { font-size:22px; font-weight:700; color:#323233; }
.num.danger { color:#ee0a24; } .num.success { color:#07c160; } .num.primary { color:#1989fa; }
.lab { font-size:11px; color:#969799; margin-top:2px; }

.section { padding: 4px 12px 12px; }
.section-title { font-size:14px; font-weight:600; margin:8px 0; color:#323233; }
.list .item { margin-bottom: 8px; }
.head { display:flex; align-items:center; gap:4px; margin-bottom:4px; }
.code { font-size:13px; font-weight:600; color:#323233; }
.actions { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
.s11 { font-size:11px; } .s12 { font-size:12px; }
.muted { color:#969799; } .danger { color:#ee0a24; }
</style>
