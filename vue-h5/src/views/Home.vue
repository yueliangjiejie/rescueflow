<template>
  <div class="app-wrap">
    <div class="hero">
      <h1>应急求助登记</h1>
      <p class="muted">让需要帮助的人,更快地被看见</p>
    </div>

    <van-notice-bar
      left-icon="warning-o"
      :text="`紧急情况请先拨打 110 / 119 / 120。本平台为民间信息协同工具,不替代官方渠道。`"
      color="#969799"
      background="#fff7e6"
    />

    <div style="padding: 16px;">
      <!-- 群策群力核心入口 -->
      <van-button type="primary" block size="large" icon="friends-o" @click="$router.push('/feed')" style="margin-bottom:10px;">
        互助信息墙(公开)
      </van-button>
      <p class="muted" style="text-align:center; font-size:12px; margin:0 0 12px;">
        所有人公开协作:需要帮助 / 能提供帮助,一目了然
      </p>

      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <van-button type="danger" block icon="edit" @click="$router.push('/register')">求助登记</van-button>
        <van-button type="success" block icon="gift-o" @click="$router.push('/offer')">我能帮什么</van-button>
      </div>
      <div style="display:flex; gap:8px;">
        <van-button type="warning" plain block icon="location-o" @click="$router.push('/water-level')">上报水位</van-button>
        <van-button type="success" plain block icon="service-o" @click="$router.push('/safety')">报平安/寻亲</van-button>
      </div>
      <p class="muted" style="text-align:center; margin-top:12px; font-size:11px; line-height:1.6;">
        登记信息经志愿者核实后流转。<br />
        上报水位可帮救援判断水情、提醒下游转移。<br />
        全程操作留痕,最小必要收集。
      </p>
    </div>
  </div>
</template>

<script setup></script>

<style scoped>
.hero { padding: 40px 16px 24px; text-align: center; }
.hero h1 { font-size: 24px; margin: 0 0 8px; }
</style>
