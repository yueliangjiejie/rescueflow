<template>
  <div class="app-wrap">
    <van-nav-bar title="群体应急闭环" left-arrow @click-left="$router.push('/admin')" />

    <div class="intro">
      <van-icon name="warning-o" color="#ee0a24" size="20" />
      <span>针对群体被困场景（如学校/小区/工厂整建制被困），建立名单→物资→责任区→记录的闭环管理。</span>
    </div>

    <van-pull-refresh v-model="loading" @refresh="load">
      <van-cell-group v-for="ev in events" :key="ev._id" inset class="event-card" @click="goEvent(ev)">
        <van-cell>
          <template #title>
            <div class="ev-head">
              <van-tag type="danger" size="medium">{{ ev.status === 'active' ? '进行中' : '已结束' }}</van-tag>
              <span class="ev-name">{{ ev.name }}</span>
            </div>
            <div class="ev-scene muted s12">{{ ev.scene }}</div>
            <div class="ev-stats">
              <div class="stat"><span class="num">{{ ev.totalRegistered }}</span><span class="lab">总人数</span></div>
              <div class="stat"><span class="num success">{{ ev.totalEvacuated }}</span><span class="lab">已撤离</span></div>
              <div class="stat"><span class="num danger">{{ ev.totalTrapped }}</span><span class="lab">在困</span></div>
              <div class="stat"><span class="num warn">{{ ev.totalMissing }}</span><span class="lab">失联</span></div>
            </div>
            <van-progress :percentage="ev.totalRegistered ? Math.round((ev.totalEvacuated) / ev.totalRegistered * 100) : 0" color="#07c160" track-color="#eee" :show-pivot="true" pivot-text="撤离率" />
          </template>
        </van-cell>
      </van-cell-group>
    </van-pull-refresh>

    <van-empty v-if="!events.length && !loading" description="暂无群体事件">
      <van-button type="danger" size="small" @click="$router.push('/roster-report')">上报群体事件</van-button>
    </van-empty>

    <div style="padding: 12px;">
      <van-button type="danger" block icon="plus" @click="$router.push('/roster-report')">上报群体事件</van-button>
      <p class="muted s11" style="text-align:center; margin-top:6px;">
        详细登记被困群体信息,平台将启动应急协调
      </p>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { listRosterEvents } from '../api/admin.js';

const router = useRouter();
const events = ref([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const res = await listRosterEvents();
    events.value = res.data.items || [];
  } catch (e) { showToast(e.message || '加载失败'); }
  finally { loading.value = false; }
}

function goEvent(ev) {
  router.push(`/admin/roster/${ev._id}`);
}

onMounted(load);
</script>

<style scoped>
.intro { display:flex; gap:6px; padding:10px 12px; background:#fff7e6; font-size:12px; color:#8c6e3a; align-items:flex-start; }
.event-card { margin-bottom: 8px; cursor: pointer; }
.ev-head { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
.ev-name { font-size:16px; font-weight:600; color:#323233; }
.ev-scene { margin-bottom:8px; line-height:1.4; }
.ev-stats { display:flex; gap:4px; margin:8px 0; }
.stat { flex:1; text-align:center; background:#f7f8fa; border-radius:6px; padding:6px 2px; }
.num { font-size:18px; font-weight:700; display:block; color:#323233; }
.num.success { color:#07c160; } .num.danger { color:#ee0a24; } .num.warn { color:#ff976a; }
.lab { font-size:10px; color:#969799; }
.s12 { font-size:12px; } .muted { color:#969799; }
</style>
