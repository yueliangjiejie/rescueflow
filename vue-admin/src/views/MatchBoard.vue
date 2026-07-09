<template>
  <div v-loading="loading">
    <!-- 汇总数字 -->
    <el-row :gutter="8" style="margin-bottom:10px;">
      <el-col :xs="12" :sm="6"><el-card shadow="never" class="s"><div class="n danger">{{d.stats.activeNeeds}}</div><div class="l">活跃需求</div></el-card></el-col>
      <el-col :xs="12" :sm="6"><el-card shadow="never" class="s"><div class="n" style="color:#07c160">{{d.stats.activeOffers}}</div><div class="l">可用供给</div></el-card></el-col>
      <el-col :xs="12" :sm="6"><el-card shadow="never" class="s"><div class="n" style="color:#1989fa">{{d.stats.inProgressMatches}}</div><div class="l">对接中</div></el-card></el-col>
      <el-col :xs="12" :sm="6"><el-card shadow="never" class="s"><div class="n" :class="{danger:d.stats.overdue>0}">{{d.stats.overdue}}</div><div class="l">超时未响应</div></el-card></el-col>
    </el-row>

    <el-row :gutter="10">
      <!-- 缺口:有需求无供给 -->
      <el-col :xs="24" :md="8">
        <el-card shadow="never">
          <template #header><span>⚠ 缺口(有需求、无对应供给)</span><span class="muted s12">需动员资源</span></template>
          <div v-for="g in d.gaps" :key="g.category" class="gap-row">
            <span class="cat">{{ g.category }}</span>
            <el-tag type="danger" size="small">{{ g.needCount }}人需要</el-tag>
          </div>
          <el-empty v-if="!d.gaps.length" :image-size="50" description="暂无缺口" />
        </el-card>
      </el-col>

      <!-- 闲置供给 -->
      <el-col :xs="24" :md="8">
        <el-card shadow="never">
          <template #header><span>💤 闲置供给(无人认领)</span><span class="muted s12">可推送匹配</span></template>
          <div v-for="o in d.idle" :key="o.code" class="idle-row">
            <div><el-tag :type="typeTag(o.type)" size="small">{{ typeLabel(o.type) }}</el-tag> <b>{{ o.title }}</b></div>
            <div class="muted s12">{{ o.location }}<span v-if="o.quantity"> · {{o.quantity}}{{o.unit}}</span></div>
          </div>
          <el-empty v-if="!d.idle.length" :image-size="50" description="暂无闲置" />
        </el-card>
      </el-col>

      <!-- 待响应对接(可操作)-->
      <el-col :xs="24" :md="8">
        <el-card shadow="never">
          <template #header><span>⏳ 待响应对接</span><el-button link type="primary" style="float:right" @click="load">刷新</el-button></template>
          <div v-for="m in d.pendingMatches" :key="m.code" class="match-row" :class="{overdue:m.isOverdue}">
            <div class="s12">{{ m.code }}</div>
            <div>需求 <b>{{ m.helpCode }}</b> ← 认领人 {{ m.fulfillerId || '?' }}</div>
            <div class="muted s12">{{ fmt(m.requestedAt) }} <span v-if="m.isOverdue" class="danger">⚠ 超时</span></div>
            <div class="actions" v-if="m._detail">
              <el-button size="small" type="success" @click="act(m,'accept')">接受</el-button>
              <el-button size="small" @click="act(m,'cancel')">取消</el-button>
            </div>
          </div>
          <el-empty v-if="!d.pendingMatches.length" :image-size="50" description="暂无待响应" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 全部进行中对接 -->
    <el-card shadow="never" style="margin-top:10px;">
      <template #header><span>进行中对接</span><span class="muted s12">点击推进状态</span></template>
      <el-table :data="ongoing" size="small" @row-click="openDetail">
        <el-table-column prop="code" label="编号" width="200" />
        <el-table-column prop="helpCode" label="需求" width="200" />
        <el-table-column prop="offerCode" label="供给" width="200" />
        <el-table-column prop="fulfillerId" label="认领人" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{row}"><el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="时间线" min-width="180">
          <template #default="{row}">
            <span class="s12">认领 {{fmt(row.requestedAt)}}</span>
            <span v-if="row.acceptedAt" class="s12"> · 接受 {{fmt(row.acceptedAt)}}</span>
            <span v-if="row.deliveredAt" class="s12"> · 送达 {{fmt(row.deliveredAt)}}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{row}">
            <el-button v-if="row.status==='requested'" size="small" type="success" @click.stop="advance(row,'accept')">接受</el-button>
            <el-button v-if="['accepted','requested'].includes(row.status)" size="small" @click.stop="advance(row,'transit')">配送</el-button>
            <el-button v-if="['accepted','in_transit'].includes(row.status)" size="small" type="primary" @click.stop="advance(row,'deliver')">送达</el-button>
            <el-button v-if="row.status!=='completed' && row.status!=='cancelled'" size="small" type="success" @click.stop="advance(row,'complete')">完成</el-button>
            <el-button v-if="row.status!=='completed' && row.status!=='cancelled'" size="small" type="danger" link @click.stop="advance(row,'cancel')">取消</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';
import { getMatchDashboard, listMatches, acceptMatch, markTransit, markDelivered, completeMatch, cancelMatch } from '../api/admin.js';

const loading = ref(false);
const d = reactive({ stats:{}, gaps:[], idle:[], pendingMatches:[] });
const ongoing = ref([]);

const typeLabel = (t) => ({supplies:'物资',transport:'运力',service:'服务',venue:'场地'}[t]||t);
const typeTag = (t) => ({supplies:'success',transport:'warning',service:'primary',venue:'info'}[t]||'');
const statusLabel = (s) => ({requested:'待响应',accepted:'已接受',in_transit:'配送中',delivered:'已送达',completed:'已完成',cancelled:'已取消'}[s]||s);
const statusType = (s) => ({requested:'warning',accepted:'primary',in_transit:'',delivered:'success',completed:'success',cancelled:'info'}[s]||'');
const fmt = (t) => t ? dayjs(t).format('MM-DD HH:mm') : '';

const ACTIONS = { accept:acceptMatch, transit:markTransit, deliver:markDelivered, complete:completeMatch, cancel:cancelMatch };

async function load() {
  loading.value = true;
  try {
    const [db, mg] = await Promise.all([getMatchDashboard(), listMatches({ pageSize: 100 })]);
    Object.assign(d, db.data);
    ongoing.value = (mg.data.items||[]).filter(m => !['completed','cancelled'].includes(m.status));
  } finally { loading.value = false; }
}

async function advance(row, action) {
  try {
    await ACTIONS[action](row.code, {});
    ElMessage.success('已更新');
    load();
  } catch(e) { ElMessage.error(e.message||'操作失败'); }
}
const act = advance;
const openDetail = () => {};

onMounted(load);
</script>

<style scoped>
.s { text-align:center; } .s .n { font-size:26px; font-weight:700; } .s .n.danger { color:#f56c6c; } .s .l { font-size:12px; color:#909399; }
.s12 { font-size:12px; } .muted { color:#909399; } .danger { color:#f56c6c; }
.gap-row { display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px dashed #eee; }
.idle-row { padding:6px 0; border-bottom:1px dashed #eee; }
.match-row { padding:8px 0; border-bottom:1px dashed #eee; }
.match-row.overdue { background:#fef0f0; }
.actions { margin-top:4px; display:flex; gap:4px; }
</style>
