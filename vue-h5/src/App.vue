<template>
  <div class="app-wrap">
    <router-view />

    <!-- 底部 5Tab 导航栏 -->
    <van-tabbar route placeholder>
      <van-tabbar-item replace to="/" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item replace to="/feed" icon="orders-o">信息墙</van-tabbar-item>
      <van-tabbar-item replace to="/intake" icon="service-o">录入</van-tabbar-item>
      <van-tabbar-item replace to="/register" icon="edit">求助</van-tabbar-item>
      <van-tabbar-item replace to="/my" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup></script>

<style>
/* 全局基础样式 */
* { box-sizing: border-box; }
body { margin: 0; background: #f7f8fa; -webkit-tap-highlight-color: transparent; }
.app-wrap { min-height: 100vh; }
.muted { color: #969799; }
</style>
