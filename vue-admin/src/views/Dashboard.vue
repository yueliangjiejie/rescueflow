<template>
  <div v-loading="loading">
    <!-- 全局总览 -->
    <el-row :gutter="10" style="margin-bottom:10px;">
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-num danger">{{ overview.helps.active || 0 }}</div>
          <div class="stat-label">待处理求助</div>
          <div class="stat-sub">待核{{overview.helps.pending}} · 已核{{overview.helps.verified}}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-num" :style="{color: occColor}">{{ overview.shelters.occupancy || 0 }}%</div>
          <div class="stat-label">安置饱和度</div>
          <div class="stat-sub">{{overview.shelters.inmates}}/{{overview.shelters.totalCapacity}}人 · {{overview.shelters.count}}个点</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-num danger">{{ overview.water?.dangerPoints || 0 }}</div>
          <div class="stat-label">危险水位点</div>
          <div class="stat-sub">共{{overview.water?.total||0}}个上报点</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-num" style="color:#07c160">{{ overview.helps.done || 0 }}</div>
          <div class="stat-label">已完成求助</div>
          <div class="stat-sub">含已脱险</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 区域态势 + 报平安快捷入口 -->
    <el-row :gutter="10">
      <el-col :xs="24" :md="14">
        <el-card shadow="never">
          <template #header>
            <span>区域态势(按最高水位排序)</span>
            <el-button link type="primary" style="float:right" @click="$router.push('/map')">查看综合地图 →</el-button>
          </template>
          <el-table :data="regions" size="small" :max-height="300">
            <el-table-column label="区域" min-width="120">
              <template #default="{ row }">{{ row._id.province }}{{ row._id.city }}{{ row._id.district }}</template>
            </el-table-column>
            <el-table-column label="最高水位" width="90">
              <template #default="{ row }">
                <el-tag :type="waterType(row.maxLevel)" size="small" effect="dark">{{ levelLabel(row.maxLevel) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="dangerCount" label="危险点" width="70" />
            <el-table-column prop="total" label="上报数" width="70" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="10">
        <el-card shadow="never" header="家属寻亲(报平安记录)">
          <el-input v-model="kinName" placeholder="输入姓名查询是否已报平安" clearable @keyup.enter="searchKin" style="margin-bottom:8px;">
            <template #append><el-button @click="searchKin">查</el-button></template>
          </el-input>
          <div v-for="r in kinResults" :key="r._id" style="padding:6px 0; border-bottom:1px dashed #eee;">
            <b>{{ r.name }}</b>
            <el-tag :type="safetyType(r.status)" size="small" style="margin-left:4px;">{{ safetyLabel(r.status) }}</el-tag>
            <div class="muted" style="font-size:12px;">{{ r.currentLocation }} · {{ fmt(r.createdAt) }}</div>
            <div v-if="r.message" style="font-size:13px;">"{{ r.message }}"</div>
          </div>
          <el-empty v-if="kinSearched && !kinResults.length" :image-size="60" description="未找到报平安记录" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { getOverview, getRegions, searchSafety } from '../api/admin.js';

const loading = ref(false);
const overview = reactive({ helps:{}, shelters:{}, water:{} });
const regions = ref([]);

const LEVELS = {0:'无积水',1:'及踝',2:'齐膝',3:'齐腰',4:'齐胸',5:'齐脖以上',6:'已淹一层'};
const levelLabel = (l) => LEVELS[l] ?? l;
const waterType = (l) => l>=5?'danger':l>=3?'warning':l>=1?'':'info';
const safetyLabel = (s) => ({safe:'已安全',sheltered:'在安置点',need_help:'仍需帮助'}[s]||s);
const safetyType = (s) => ({safe:'success',sheltered:'primary',need_help:'danger'}[s]||'info');
const fmt = (t) => t ? new Date(t).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
const occColor = computed(() => (overview.shelters.occupancy||0)>=90?'#f56c6c':(overview.shelters.occupancy||0)>=70?'#e6a23c':'#07c160');

// 寻亲
const kinName = ref('');
const kinResults = ref([]);
const kinSearched = ref(false);
async function searchKin() {
  if (!kinName.value) return;
  const res = await searchSafety({ name: kinName.value });
  kinResults.value = res.data || [];
  kinSearched.value = true;
}

async function load() {
  loading.value = true;
  try {
    const [ov, rg] = await Promise.all([getOverview(), getRegions({ hours: 48 })]);
    Object.assign(overview, ov.data);
    regions.value = rg.data || [];
  } finally { loading.value = false; }
}
onMounted(load);
</script>

<style scoped>
.stat-card { text-align:center; }
.stat-num { font-size:28px; font-weight:700; }
.stat-num.danger { color:#f56c6c; }
.stat-label { font-size:13px; color:#606266; margin-top:2px; }
.stat-sub { font-size:11px; color:#909399; margin-top:2px; }
</style>
