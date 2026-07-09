<template>
  <div class="app-wrap">
    <van-nav-bar title="管理后台" left-arrow @click-left="$router.push('/my')" />

    <div class="admin-header">
      <van-icon name="shield-o" size="40" color="#fff" />
      <div class="admin-name">{{ user?.name || '管理员' }}</div>
      <div class="admin-role">{{ roleLabel(user?.role) }} · {{ user?.username }}</div>
    </div>

    <div class="section">
      <div class="section-title">管理功能</div>
      <div class="entry-card" @click="$router.push('/admin/helps')">
        <div class="entry-icon" style="background:#fff1f0; color:#ee0a24;"><van-icon name="edit" /></div>
        <div class="entry-body">
          <div class="entry-title">求助审批</div>
          <div class="entry-desc">核实求助信息、转交、标记完成</div>
        </div>
        <van-icon name="arrow" color="#c8c9cc" />
      </div>
      <div class="entry-card" @click="$router.push('/admin/volunteers')">
        <div class="entry-icon" style="background:#f6ffed; color:#07c160;"><van-icon name="friends-o" /></div>
        <div class="entry-body">
          <div class="entry-title">志愿者审批</div>
          <div class="entry-desc">审核志愿者申请,通过或拒绝</div>
        </div>
        <van-icon name="arrow" color="#c8c9cc" />
      </div>
      <div class="entry-card" @click="$router.push('/admin/match')">
        <div class="entry-icon" style="background:#e6f7ff; color:#1989fa;"><van-icon name="exchange" /></div>
        <div class="entry-body">
          <div class="entry-title">供需对接</div>
          <div class="entry-desc">查看缺口/闲置供给、推进对接进度</div>
        </div>
        <van-icon name="arrow" color="#c8c9cc" />
      </div>
    </div>

    <div class="section">
      <van-cell-group inset>
        <van-cell title="退出登录" icon="cross" is-link @click="logout" />
      </van-cell-group>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { showSuccessToast } from 'vant';

const router = useRouter();
const user = computed(() => {
  try { return JSON.parse(localStorage.getItem('rf_user') || 'null'); }
  catch { return null; }
});
const roleLabel = (r) => ({ admin: '管理员', operator: '操作员', volunteer: '志愿者' }[r] || r);

function logout() {
  localStorage.removeItem('rf_token');
  localStorage.removeItem('rf_user');
  localStorage.removeItem('rf_actor_id');
  localStorage.removeItem('rf_actor_role');
  showSuccessToast('已退出');
  router.replace('/my');
}
</script>

<style scoped>
.admin-header {
  background: linear-gradient(135deg, #1989fa 0%, #0d6efd 100%);
  padding: 28px 16px 24px;
  text-align: center;
  color: #fff;
}
.admin-name { color: #fff; font-size: 17px; font-weight: 600; margin-top: 8px; }
.admin-role { color: rgba(255,255,255,0.8); font-size: 12px; margin-top: 2px; }

.section { padding: 12px; }
.section-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #323233; }
.entry-card {
  display: flex; align-items: center; gap: 12px;
  background: #fff; border-radius: 10px; padding: 14px; margin-bottom: 8px;
}
.entry-card:active { background: #f7f8fa; }
.entry-icon {
  width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 22px;
}
.entry-body { flex: 1; }
.entry-title { font-size: 15px; font-weight: 600; color: #323233; }
.entry-desc { font-size: 12px; color: #969799; margin-top: 2px; }
</style>
