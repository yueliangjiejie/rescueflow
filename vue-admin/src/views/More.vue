<template>
  <div>
    <el-card shadow="never" header="更多功能">
      <div class="grid">
        <div class="item" @click="$router.push('/map')">
          <el-icon :size="28" color="#1989fa"><Location /></el-icon>
          <span>综合地图</span>
          <span class="muted">求助/水位/道路/避难所</span>
        </div>
        <div class="item" @click="$router.push('/shelter')">
          <el-icon :size="28" color="#07c160"><House /></el-icon>
          <span>避难所/物资</span>
          <span class="muted">容量·库存·寻亲</span>
        </div>
        <div class="item" @click="$router.push('/dashboard')">
          <el-icon :size="28" color="#e6a23c"><DataLine /></el-icon>
          <span>态势看板</span>
          <span class="muted">水位涨势·区域分布</span>
        </div>
        <div class="item" @click="$router.push('/intake')">
          <el-icon :size="28" color="#9c27b0"><MagicStick /></el-icon>
          <span>智能录入</span>
          <span class="muted">粘贴文本·AI拆解</span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { Location, House, DataLine, MagicStick } from '@element-plus/icons-vue';
</script>

<style scoped>
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:10px; }
.item { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:18px 8px; border:1px solid #ebeef5; border-radius:8px; gap:4px; cursor:pointer; }
.item:active { background:#f5f7fa; }
.item span:nth-child(2) { font-size:14px; font-weight:600; }
.item .muted { font-size:11px; color:#909399; text-align:center; }
</style>
