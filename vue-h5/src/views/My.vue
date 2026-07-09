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
    <van-cell-group inset title="管理员" v-if="isAdmin">
      <van-cell title="管理后台" icon="setting-o" is-link @click="goAdmin">
        <template #right-icon>
          <van-tag type="danger" size="small">后台</van-tag>
        </template>
      </van-cell>
      <van-cell title="审批管理" icon="friends-o" is-link @click="goAdmin('manage')" />
      <van-cell title="供需对接" icon="exchange" is-link @click="goAdmin('match')" />
    </van-cell-group>

    <div style="padding: 20px; text-align:center;">
      <van-button size="small" plain type="primary" @click="toggleAdmin">
        {{ isAdmin ? '退出管理模式' : '切换为管理员' }}
      </van-button>
      <p class="muted" style="font-size:11px; margin-top:8px;">
        管理员入口：审批志愿者、管理供需对接、核实求助信息
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { showToast, showSuccessToast } from 'vant';

const myId = ref(localStorage.getItem('rf_uid') || '');
const myPhone = ref(localStorage.getItem('rf_phone') || '');
const isAdmin = ref(localStorage.getItem('rf_admin') === '1');
const myHelpsCount = ref(0);

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
  myPhone.value = '';
  myId.value = '';
  isAdmin.value = false;
  showToast('已清除');
}

function toggleAdmin() {
  isAdmin.value = !isAdmin.value;
  localStorage.setItem('rf_admin', isAdmin.value ? '1' : '0');
  showToast(isAdmin.value ? '已切换为管理员' : '已退出管理模式');
}

function goAdmin(path) {
  // 管理后台通常运行在 5174 端口
  const adminBase = window.location.origin.replace(':5173', ':5174');
  if (path) {
    window.open(`${adminBase}/#${path}`, '_blank');
  } else {
    window.open(adminBase, '_blank');
  }
}

onMounted(() => {
  if (!myId.value) {
    myId.value = 'u' + Date.now();
    localStorage.setItem('rf_uid', myId.value);
  }
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
