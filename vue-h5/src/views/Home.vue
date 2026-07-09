<template>
  <div class="app-wrap">
    <!-- Hero 区 -->
    <div class="hero">
      <h1>RescueFlow</h1>
      <p class="hero-sub">AI 应急信息协同平台</p>
      <p class="hero-tip">紧急情况请先拨打 110 / 119 / 120</p>
    </div>

    <van-notice-bar
      left-icon="warning-o"
      text="本平台为民间信息协同工具,不替代官方渠道,信息需人工核实。"
      color="#969799"
      background="#fff7e6"
    />

    <!-- 数据看板(与后台同源) -->
    <div class="dashboard" v-if="overview">
      <div class="dash-title">📊 实时态势</div>
      <div class="dash-grid">
        <div class="dash-cell">
          <div class="dash-num danger">{{ overview.helps?.active || 0 }}</div>
          <div class="dash-label">待处理</div>
          <div class="dash-sub">待核{{ overview.helps?.pending || 0 }} · 已核{{ overview.helps?.verified || 0 }}</div>
        </div>
        <div class="dash-cell">
          <div class="dash-num success">{{ overview.helps?.done || 0 }}</div>
          <div class="dash-label">已完成</div>
          <div class="dash-sub">含已脱险</div>
        </div>
        <div class="dash-cell">
          <div class="dash-num warn">{{ overview.water?.dangerPoints || 0 }}</div>
          <div class="dash-label">危险水位</div>
          <div class="dash-sub">共{{ overview.water?.total || 0 }}个点</div>
        </div>
        <div class="dash-cell">
          <div class="dash-num" :class="occClass">{{ overview.shelters?.occupancy || 0 }}%</div>
          <div class="dash-label">安置饱和</div>
          <div class="dash-sub">{{ overview.shelters?.inmates || 0 }}/{{ overview.shelters?.totalCapacity || 0 }}人</div>
        </div>
      </div>
    </div>
    <van-skeleton v-else title :row="2" style="padding:16px;" />

    <!-- 智能录入(核心入口) -->
    <div class="section">
      <div class="intake-card" @click="$router.push('/intake')">
        <div class="intake-left">
          <van-icon name="service-o" size="32" color="#fff" />
        </div>
        <div class="intake-body">
          <div class="intake-title">智能录入</div>
          <div class="intake-desc">粘贴群聊/新闻文本,AI 自动拆解为多条记录</div>
        </div>
        <van-icon name="arrow" color="#fff" />
      </div>
    </div>

    <!-- 快捷功能 -->
    <div class="section">
      <div class="section-title">快捷功能</div>
      <div class="quick-grid">
        <div class="quick-item" @click="$router.push('/feed')">
          <div class="quick-icon" style="background:#e6f7ff; color:#1989fa;"><van-icon name="orders-o" /></div>
          <span>互助信息墙</span>
        </div>
        <div class="quick-item" @click="$router.push('/register')">
          <div class="quick-icon" style="background:#fff1f0; color:#ee0a24;"><van-icon name="edit" /></div>
          <span>求助登记</span>
        </div>
        <div class="quick-item" @click="$router.push('/offer')">
          <div class="quick-icon" style="background:#f6ffed; color:#07c160;"><van-icon name="gift-o" /></div>
          <span>我能帮什么</span>
        </div>
        <div class="quick-item" @click="$router.push('/water-level')">
          <div class="quick-icon" style="background:#fff7e6; color:#ff976a;"><van-icon name="location-o" /></div>
          <span>上报水位</span>
        </div>
        <div class="quick-item" @click="$router.push('/safety')">
          <div class="quick-icon" style="background:#f0f5ff; color:#1989fa;"><van-icon name="service-o" /></div>
          <span>报平安/寻亲</span>
        </div>
        <div class="quick-item" @click="$router.push('/my-matches')">
          <div class="quick-icon" style="background:#f9f0ff; color:#722ed1;"><van-icon name="medal-o" /></div>
          <span>我的认领</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import http from '../api/http.js';

const overview = ref(null);
const occClass = computed(() => {
  const o = overview.value?.shelters?.occupancy || 0;
  return o >= 90 ? 'danger' : o >= 70 ? 'warn' : 'success';
});

async function load() {
  try {
    const res = await http.get('/api/dashboard/overview');
    overview.value = res.data;
  } catch { /* 降级:不显示看板 */ }
}
onMounted(load);
</script>

<style scoped>
.hero {
  background: linear-gradient(135deg, #ee0a24 0%, #c00 100%);
  padding: 36px 16px 24px;
  text-align: center;
  color: #fff;
}
.hero h1 { margin: 0; font-size: 26px; letter-spacing: 1px; }
.hero-sub { margin: 6px 0 0; font-size: 14px; opacity: 0.9; }
.hero-tip { margin: 10px 0 0; font-size: 11px; opacity: 0.7; }

.dashboard { padding: 12px; }
.dash-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #323233; }
.dash-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
  background: #fff; border-radius: 8px; padding: 10px 6px;
}
.dash-cell { text-align: center; }
.dash-num { font-size: 22px; font-weight: 700; }
.dash-num.danger { color: #ee0a24; }
.dash-num.success { color: #07c160; }
.dash-num.warn { color: #ff976a; }
.dash-label { font-size: 12px; color: #646566; margin-top: 2px; }
.dash-sub { font-size: 10px; color: #969799; margin-top: 2px; }

.section { padding: 8px 12px; }
.section-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #323233; }

.intake-card {
  display: flex; align-items: center; gap: 12px;
  background: linear-gradient(135deg, #1989fa 0%, #0d6efd 100%);
  border-radius: 12px; padding: 16px;
  box-shadow: 0 4px 12px rgba(24, 137, 250, 0.3);
  cursor: pointer;
}
.intake-left { flex-shrink: 0; }
.intake-body { flex: 1; }
.intake-title { color: #fff; font-size: 17px; font-weight: 600; }
.intake-desc { color: rgba(255,255,255,0.85); font-size: 12px; margin-top: 4px; }

.quick-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
}
.quick-item {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  background: #fff; border-radius: 10px; padding: 14px 6px;
  cursor: pointer; transition: transform 0.1s;
}
.quick-item:active { transform: scale(0.96); }
.quick-icon {
  width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px;
}
.quick-item span { font-size: 12px; color: #323233; }
</style>
