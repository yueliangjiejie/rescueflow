<template>
  <div class="app-wrap">
    <div class="ok-wrap">
      <van-icon name="checked" size="64" color="#07c160" />
      <h2>{{ code === 'pending' ? '已暂存' : '提交成功' }}</h2>
      <p class="muted">
        <template v-if="code === 'pending'">
          您的求助已暂存到本机,联网后将自动提交。
        </template>
        <template v-else>
          编号:<b>{{ code }}</b><br />
          志愿者将尽快核实。
        </template>
      </p>
      <p class="danger-tip">如情况危急,请立即拨打 110 / 119 / 120。</p>
      <van-button type="primary" block style="margin-top: 24px;" @click="$router.push('/')">返回首页</van-button>
    </div>
  </div>
</template>

<script setup>
defineProps({ code: { type: String, default: '' } });
</script>

<style scoped>
.ok-wrap { padding: 64px 24px; text-align: center; }
.ok-wrap h2 { margin: 16px 0 8px; }
.danger-tip { color: var(--rf-danger); font-size: 13px; margin-top: 16px; }
</style>
