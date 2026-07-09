<template>
  <div class="app-wrap">
    <div class="my-header">
      <div class="my-avatar">
        <van-icon name="user-o" size="40" color="#fff" />
      </div>
      <div class="my-name">{{ myPhone || '未登录' }}</div>
      <div class="my-phone" v-if="myPhone">ID: {{ myId }}</div>
    </div>

    <van-cell-group inset title="我的">
      <van-cell title="我的认领" icon="hand-down-o" is-link to="/my-matches" value="查看对接进度" />
      <van-cell title="我发布的求助" icon="edit" is-link :to="myHelpsCount > 0 ? '/my-helps' : ''" :value="myHelpsCount ? myHelpsCount + '条' : '暂无'" />
    </van-cell-group>

    <van-cell-group inset title="设置">
      <van-field v-model="myPhone" label="我的电话" placeholder="用于识别我的认领/发布" type="tel" @blur="savePhone" />
      <van-cell title="清除缓存" icon="replay" is-link @click="clearCache" />
    </van-cell-group>

    <!-- 管理员入口 -->
    <van-cell-group inset title="管理员" v-if="isLoggedIn">
      <van-cell title="管理后台" icon="shield-o" is-link to="/admin">
        <template #value>
          <van-tag type="primary" size="small">{{ user?.name || '管理员' }}</van-tag>
        </template>
      </van-cell>
      <van-cell title="求助审批" icon="edit" is-link to="/admin/helps" />
      <van-cell title="志愿者审批" icon="friends-o" is-link to="/admin/volunteers" />
      <van-cell title="供需对接" icon="exchange" is-link to="/admin/match" />
    </van-cell-group>
    <van-cell-group inset title="管理员" v-else>
      <van-cell title="管理员登录" icon="lock" is-link to="/login">
        <template #value>
          <van-tag type="warning" size="small">未登录</van-tag>
        </template>
      </van-cell>
    </van-cell-group>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { showToast, showSuccessToast } from 'vant';

const myId = ref(localStorage.getItem('rf_uid') || '');
const myPhone = ref(localStorage.getItem('rf_phone') || '');
const isLoggedIn = computed(() => !!localStorage.getItem('rf_token'));
const user = computed(() => {
  try { return JSON.parse(localStorage.getItem('rf_user') || 'null'); }
  catch { return null; }
});
const myHelpsCount = ref(0);

function refreshHelpsCount() {
  try {
    myHelpsCount.value = JSON.parse(localStorage.getItem('rf_my_helps') || '[]').length;
  } catch { myHelpsCount.value = 0; }
}

function savePhone() {
  if (myPhone.value) {
    localStorage.setItem('rf_phone', myPhone.value);
    if (!myId.value) {
      myId.value = 'u' + Date.now();
      localStorage.setItem('rf_uid', myId.value);
    }
    showSuccessToast('已保存');
  }
}

function clearCache() {
  localStorage.removeItem('rf_phone');
  localStorage.removeItem('rf_uid');
  localStorage.removeItem('rf_admin');
  // 不清除管理员登录态(rf_token 等),避免误退出
  myPhone.value = '';
  myId.value = '';
  showToast('已清除');
}

onMounted(() => {
  if (!myId.value) {
    myId.value = 'u' + Date.now();
    localStorage.setItem('rf_uid', myId.value);
  }
  refreshHelpsCount();
});
</script>

<style scoped>
.my-header {
  background: linear-gradient(135deg, #1989fa 0%, #0d6efd 100%);
  padding: 32px 16px 20px;
  text-align: center;
}
.my-avatar {
  width: 60px; height: 60px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}
.my-name { color: #fff; font-size: 16px; font-weight: 600; }
.my-phone { color: rgba(255,255,255,0.7); font-size: 12px; margin-top: 2px; }
.muted { color:#969799; }
</style>
