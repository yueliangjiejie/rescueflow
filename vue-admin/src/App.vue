<template>
  <div class="app-root">
    <!-- 桌面端:顶部导航(≥768px) -->
    <el-container v-if="!isMobile" style="min-height:100vh;">
      <el-header style="background:#001529; color:#fff; display:flex; align-items:center;">
        <h2 style="margin:0; color:#fff; font-size:18px;">RescueFlow · 应急求助协同</h2>
        <el-menu mode="horizontal" :default-active="$route.path" :ellipsis="false"
          background-color="#001529" text-color="#fff" active-text-color="#409EFF"
          router style="margin-left:24px; border:none;">
          <el-menu-item index="/dashboard">态势看板</el-menu-item>
          <el-menu-item index="/match">供需对接</el-menu-item>
          <el-menu-item index="/intake">智能录入</el-menu-item>
          <el-menu-item index="/map">综合地图</el-menu-item>
          <el-menu-item index="/helps">求助列表</el-menu-item>
          <el-menu-item index="/shelter">避难所/物资</el-menu-item>
          <el-menu-item index="/manage">管理</el-menu-item>
        </el-menu>
        <span style="margin-left:auto; font-size:12px; color:#aaa;">全程留痕 · 信息需人工核实</span>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>

    <!-- 移动端:简洁顶栏 + 底部 TabBar(<768px) -->
    <div v-else class="mobile-app">
      <div class="m-header">
        <span class="m-title">{{ pageTitle }}</span>
        <span class="m-sub">不替代 110/119/120</span>
      </div>
      <div class="m-content">
        <router-view />
      </div>
      <div class="m-tabbar">
        <div v-for="t in tabs" :key="t.path" class="m-tab"
          :class="{active: $route.path.startsWith(t.path)}" @click="$router.push(t.path)">
          <el-icon :size="22"><component :is="t.icon" /></el-icon>
          <span>{{ t.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { DataLine, Document, MagicStick, Connection, More } from '@element-plus/icons-vue';

const route = useRoute();
const isMobile = ref(window.innerWidth < 768);
const onResize = () => { isMobile.value = window.innerWidth < 768; };
onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));

const tabs = [
  { path: '/dashboard', label: '看板', icon: DataLine },
  { path: '/match', label: '对接', icon: Connection },
  { path: '/intake', label: '录入', icon: MagicStick },
  { path: '/helps', label: '求助', icon: Document },
  { path: '/more', label: '更多', icon: More },
];

const pageTitle = computed(() => {
  const t = tabs.find(t => route.path.startsWith(t.path));
  return t ? t.label : 'RescueFlow';
});
</script>

<style>
/* 全局:移动端取消 Element 默认的较大内边距,贴近原生 App 体验 */
.app-root { min-height:100vh; background:#f0f2f5; }

/* 移动端布局 */
.mobile-app { display:flex; flex-direction:column; min-height:100vh; background:#f0f2f5; }
.m-header {
  position:sticky; top:0; z-index:10;
  background:#001529; color:#fff; padding:12px 16px;
  display:flex; align-items:baseline; gap:8px;
}
.m-title { font-size:17px; font-weight:600; }
.m-sub { font-size:11px; color:#aaa; margin-left:auto; }
.m-content { flex:1; padding:10px; padding-bottom:64px; /* 给底部 tabbar 留位 */ }
.m-tabbar {
  position:fixed; bottom:0; left:0; right:0; z-index:20;
  display:flex; background:#fff; border-top:1px solid #e4e7ed;
  box-shadow:0 -2px 8px rgba(0,0,0,0.06);
  max-width:100%;
}
.m-tab {
  flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:7px 0; color:#909399; font-size:10px; gap:2px;
  -webkit-tap-highlight-color: transparent;
  min-width:0;
}
.m-tab span { white-space:nowrap; overflow:hidden; }
.m-tab.active { color:#1989fa; }
.m-tab.active .el-icon { transform: scale(1.1); }

/* 移动端:表格横向滚动 + 卡片间距紧凑 */
@media (max-width: 768px) {
  .el-card { margin-bottom:8px !important; }
  .el-card__body { padding:10px !important; }
  .stat-num { font-size:24px !important; }
}
</style>
