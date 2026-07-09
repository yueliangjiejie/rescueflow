<template>
  <div class="app-wrap dispatch">
    <van-nav-bar title="调度看板" left-arrow @click-left="$router.back()">
      <template #right>
        <van-icon name="refresh" size="20" @click="loadAll" />
      </template>
    </van-nav-bar>

    <!-- 运力概览 -->
    <div class="overview" v-if="pool">
      <div class="ov-item"><span class="ov-num" :class="{active:tab==='needs'}">{{ pendingNeeds.length }}</span><span class="ov-lab">待调度</span></div>
      <div class="ov-item"><span class="ov-num success">{{ pool.idle }}</span><span class="ov-lab">待命</span></div>
      <div class="ov-item"><span class="ov-num primary">{{ pool.busy }}</span><span class="ov-lab">执行中</span></div>
      <div class="ov-item"><span class="ov-num">{{ ongoing.length }}</span><span class="ov-lab">对接中</span></div>
    </div>

    <!-- 地图区(占屏 40%) -->
    <div class="map-wrap">
      <LMap :zoom="zoom" :center="center" :min-zoom="5" :max-zoom="18" style="height:100%;width:100%;" v-if="showMap">
        <LTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" :max-zoom="19" />
        <!-- 求助点(红/橙) -->
        <LMarker v-for="h in mapHelps" :key="'h'+h.code" :lat-lng="[h.location.coordinates[1], h.location.coordinates[0]]" @click="selectNeed(h)">
          <LIcon :icon-url="pinSvg(h.urgency==='critical'?'#ee0a24':'#ff976a')" :icon-size="[22,22]" />
          <LPopup>
            <div style="min-width:140px;">
              <strong>{{ h.code }}</strong>
              <div style="font-size:12px; margin:4px 0;">{{ h.content?.summary?.slice(0,40) }}</div>
              <div style="font-size:11px; color:#969799;">{{ h.location?.address }}</div>
            </div>
          </LPopup>
        </LMarker>
        <!-- 志愿者(蓝=待命/灰=离线/绿=执行中) -->
        <LMarker v-for="v in mapVolunteers" :key="'v'+v.uid" :lat-lng="[v.serviceArea.coordinates[1], v.serviceArea.coordinates[0]]">
          <LIcon :icon-url="pinSvg(v.status==='idle'?'#1989fa':v.status==='busy'?'#07c160':'#c8c9cc', 'square')" :icon-size="[18,18]" />
          <LPopup>
            <div style="min-width:130px;">
              <strong>{{ v.name }}</strong>
              <van-tag :type="v.status==='idle'?'primary':v.status==='busy'?'success':'default'" size="mini">{{ statusLabel(v.status) }}</van-tag>
              <div style="font-size:11px; margin:4px 0;">技能:{{ v.skills.join('/') }}</div>
              <div style="font-size:11px; color:#969799;">{{ v.serviceArea.address }}</div>
            </div>
          </LPopup>
        </LMarker>
      </LMap>
      <div class="map-legend">
        ●求助(红紧急/橙一般) ■志愿者(蓝待命/绿执行中/灰离线)
      </div>
    </div>

    <!-- Tab 切换 -->
    <van-tabs v-model:active="tab" shrink>
      <van-tab title="待调度" name="needs" :badge="pendingNeeds.length || ''" />
      <van-tab title="运力池" name="pool" />
      <van-tab title="进行中" name="ongoing" :badge="ongoing.length || ''" />
    </van-tabs>

    <!-- 待调度需求:点开看推荐 -->
    <div v-if="tab==='needs'" class="list">
      <van-cell-group v-for="h in pendingNeeds" :key="h.code" inset class="item">
        <van-cell is-link @click="toggleReco(h)">
          <template #title>
            <div class="head">
              <van-tag type="danger" size="medium">需求</van-tag>
              <van-tag v-if="h.urgency==='critical'" type="danger" size="mini">紧急</van-tag>
              <van-tag v-if="h.slaBreached" type="danger" size="mini">⚠超时</van-tag>
            </div>
            <div class="code">{{ h.code }}</div>
            <div class="summary">{{ h.content?.summary || h.content?.rawText }}</div>
            <div class="meta"><van-icon name="location-o" />{{ h.location?.address || '位置未填' }}</div>
          </template>
        </van-cell>

        <!-- 推荐志愿者区 -->
        <div v-if="h._expanded" class="reco">
          <div class="reco-title">系统推荐志愿者</div>
          <van-loading v-if="h._loading" size="18px" style="padding:8px;">匹配中...</van-loading>
          <div v-else-if="h._recos?.length" class="reco-list">
            <div v-for="(r, idx) in h._recos" :key="r.uid" class="reco-card" :class="{top: idx===0}">
              <div class="reco-head">
                <van-tag :type="idx===0?'success':'plain'" size="mini">推荐{{ idx+1 }}</van-tag>
                <span class="reco-name">{{ r.name }}</span>
                <span class="reco-score">匹配度 {{ r._matchScore }}</span>
                <van-tag :type="r.status==='idle'?'primary':'warning'" size="mini">{{ statusLabel(r.status) }}</van-tag>
              </div>
              <div class="reco-skills">
                <van-tag v-for="s in r.skills" :key="s" :type="r._matchedSkills.includes(s)?'danger':'plain'" size="mini">{{ s }}</van-tag>
              </div>
              <div class="reco-reason">{{ r._reasons.join(' · ') }}</div>
              <div class="reco-meta">
                <van-icon name="phone-o" />{{ r.phone }}
                <span style="margin-left:6px;">· {{ r.serviceArea.address }}</span>
              </div>
              <van-button size="small" type="primary" block :loading="r._assigning" @click="assign(h, r)">指派给 {{ r.name }}</van-button>
            </div>
          </div>
          <van-empty v-else image-size="50" description="暂无推荐" />
        </div>
      </van-cell-group>
      <van-empty v-if="!pendingNeeds.length" description="暂无待调度需求" />
    </div>

    <!-- 运力池 -->
    <div v-else-if="tab==='pool'" class="list">
      <van-cell-group v-for="v in pool?.items" :key="v.uid" inset class="item">
        <van-cell>
          <template #title>
            <div class="head">
              <van-tag :type="statusType(v.status)" size="medium">{{ statusLabel(v.status) }}</van-tag>
              <span class="vol-name">{{ v.name }}</span>
              <span class="muted s11" style="margin-left:auto;">{{ v.org }}</span>
            </div>
            <div class="reco-skills">
              <van-tag v-for="s in v.skills" :key="s" plain type="primary" size="mini">{{ s }}</van-tag>
            </div>
            <div class="meta"><van-icon name="location-o" />{{ v.serviceArea.address }} · 已完成{{ v.completedCount }}次</div>
            <div class="meta"><van-icon name="phone-o" /><a :href="'tel:'+v.phone" class="call-link">{{ v.phone }}</a> · 当前{{ v.activeCount }}单</div>
          </template>
        </van-cell>
        <div class="actions">
          <van-button size="mini" :type="v.status==='idle'?'primary':'default'" @click="setVolStatus(v,'idle')">设为待命</van-button>
          <van-button size="mini" :type="v.status==='busy'?'warning':'default'" @click="setVolStatus(v,'busy')">设为执行中</van-button>
          <van-button size="mini" :type="v.status==='offline'?'default':'default'" plain @click="setVolStatus(v,'offline')">设为离线</van-button>
        </div>
      </van-cell-group>
    </div>

    <!-- 进行中对接 -->
    <div v-else class="list">
      <van-cell-group v-for="m in ongoing" :key="m.code" inset class="item">
        <van-cell>
          <template #title>
            <div class="head">
              <van-tag :type="mType(m.status)" size="medium">{{ mLabel(m.status) }}</van-tag>
              <span v-if="m.isOverdue" class="danger s11">⚠超时</span>
              <span class="muted s11" style="margin-left:auto;">{{ fmt(m.requestedAt) }}</span>
            </div>
            <div class="code">需求 {{ m.helpCode }}</div>
            <div class="meta">志愿者 {{ m.fulfillerName }} <a v-if="m.fulfillerPhone" :href="'tel:'+m.fulfillerPhone" class="call-link">{{ m.fulfillerPhone }}</a></div>
            <div v-if="m.note" class="match-note">{{ m.note }}</div>
            <div class="actions">
              <van-button v-if="m.status==='requested'" size="mini" type="success" @click="adv(m,'accept')">接受</van-button>
              <van-button v-if="['requested','accepted'].includes(m.status)" size="mini" type="primary" @click="adv(m,'transit')">出发</van-button>
              <van-button v-if="['accepted','in_transit'].includes(m.status)" size="mini" type="primary" @click="adv(m,'deliver')">送达</van-button>
              <van-button v-if="!['completed','cancelled'].includes(m.status)" size="mini" type="success" @click="adv(m,'complete')">完成</van-button>
            </div>
          </template>
        </van-cell>
      </van-cell-group>
      <van-empty v-if="!ongoing.length" description="暂无进行中对接" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { showToast, showSuccessToast } from 'vant';
import { LMap, LTileLayer, LMarker, LPopup, LIcon } from '@vue-leaflet/vue-leaflet';
import 'leaflet/dist/leaflet.css';
import { listHelps, getVolunteerPool, updateVolunteerStatus, getRecommendations, dispatchAssign, listMatches, acceptMatch, markTransit, markDelivered, completeMatch } from '../api/admin.js';

const showMap = ref(true);
const zoom = ref(7);
const center = ref([23.0, 109.5]); // 广西中心
const tab = ref('needs');

const pool = ref(null);
const allHelps = ref([]);
const ongoing = ref([]);

// 待调度需求 = 已核实/处理中的活跃求助
const pendingNeeds = computed(() => allHelps.value.filter(h => ['verified','in_progress'].includes(h.status)));
// 地图数据
const mapHelps = computed(() => pendingNeeds.value.filter(h => h.location?.coordinates?.length === 2));
const mapVolunteers = computed(() => (pool.value?.items || []).filter(v => v.serviceArea?.coordinates?.length === 2));

const statusLabel = (s) => ({ idle:'待命', busy:'执行中', offline:'离线' }[s] || s);
const statusType = (s) => ({ idle:'primary', busy:'success', offline:'default' }[s] || 'default');
const mLabel = (s) => ({ requested:'待响应', accepted:'已接受', in_transit:'配送中', delivered:'已送达', completed:'已完成', cancelled:'已取消' }[s] || s);
const mType = (s) => ({ requested:'warning', accepted:'primary', in_transit:'', delivered:'success', completed:'success', cancelled:'default' }[s] || 'default');
const fmt = (t) => t ? new Date(t).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';

// SVG 图钉生成(免外部图片)
function pinSvg(color, shape = 'circle') {
  const inner = shape === 'square'
    ? `<rect x="2" y="2" width="14" height="14" rx="3" fill="${color}" stroke="#fff" stroke-width="2"/>`
    : `<circle cx="9" cy="9" r="8" fill="${color}" stroke="#fff" stroke-width="2"/>`;
  return 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">${inner}</svg>`);
}

async function loadAll() {
  try {
    const [p, hl, mg] = await Promise.all([getVolunteerPool(), listHelps({ pageSize: 100 }), listMatches({ pageSize: 100 })]);
    pool.value = p.data;
    allHelps.value = hl.data.items || [];
    ongoing.value = (mg.data.items || []).filter(m => !['completed','cancelled'].includes(m.status));
  } catch (e) { showToast(e.message || '加载失败'); }
}

// 展开推荐
async function toggleReco(h) {
  h._expanded = !h._expanded;
  if (h._expanded && !h._recos) {
    h._loading = true;
    try {
      const res = await getRecommendations(h.code);
      h._recos = (res.data.recommendations || []).map(r => ({ ...r, _assigning: false }));
      h._neededSkills = res.data.neededSkills || [];
    } catch (e) { showToast(e.message || '推荐失败'); }
    finally { h._loading = false; }
  }
}
function selectNeed(h) { tab.value = 'needs'; toggleReco(h); }

// 指派
async function assign(h, r) {
  r._assigning = true;
  try {
    const res = await dispatchAssign(h.code, r.uid, `管理员指派:${r._reasons.join(',')}`);
    showSuccessToast(res.message || '指派成功');
    h._expanded = false;
    tab.value = 'ongoing';
    loadAll();
  } catch (e) { showToast(e.message || '指派失败'); }
  finally { r._assigning = false; }
}

// 志愿者状态切换
async function setVolStatus(v, status) {
  try {
    await updateVolunteerStatus(v.uid, status);
    v.status = status;
    showSuccessToast('已更新');
  } catch (e) { showToast(e.message || '更新失败'); }
}

// 对接推进
const ACTIONS = { accept:acceptMatch, transit:markTransit, deliver:markDelivered, complete:completeMatch };
async function adv(m, action) {
  try {
    await ACTIONS[action](m.code);
    showSuccessToast('已更新');
    loadAll();
  } catch (e) { showToast(e.message || '操作失败'); }
}

onMounted(loadAll);
</script>

<style scoped>
.dispatch { display:flex; flex-direction:column; height:100vh; overflow:hidden; }
.overview { display:flex; background:#fff; padding:8px 4px; border-bottom:1px solid #f0f0f0; }
.ov-item { flex:1; text-align:center; }
.ov-num { font-size:20px; font-weight:700; color:#323233; display:block; }
.ov-num.active { color:#ee0a24; }
.ov-num.success { color:#07c160; }
.ov-num.primary { color:#1989fa; }
.ov-lab { font-size:10px; color:#969799; }

.map-wrap { height:38vh; min-height:240px; position:relative; border-bottom:1px solid #eee; }
.map-legend { position:absolute; bottom:4px; left:4px; right:4px; background:rgba(255,255,255,0.92); border-radius:4px; padding:3px 6px; font-size:9px; color:#646566; pointer-events:none; }

.list { flex:1; overflow-y:auto; padding-bottom:80px; }
.item { margin: 6px 8px; }
.head { display:flex; align-items:center; gap:4px; }
.code { font-size:11px; color:#1989fa; font-weight:600; }
.summary { font-size:14px; color:#323233; margin:3px 0; line-height:1.4; }
.meta { font-size:12px; color:#969799; margin-top:2px; }
.call-link { color:#1989fa; text-decoration:none; }

/* 推荐 */
.reco { background:#f7f8fa; padding:8px 12px; border-top:1px dashed #ddd; }
.reco-title { font-size:12px; font-weight:600; color:#646566; margin-bottom:6px; }
.reco-list { display:flex; flex-direction:column; gap:8px; }
.reco-card { background:#fff; border-radius:8px; padding:10px; border-left:3px solid #ddd; }
.reco-card.top { border-left-color:#07c160; }
.reco-head { display:flex; align-items:center; gap:4px; flex-wrap:wrap; margin-bottom:4px; }
.reco-name { font-size:14px; font-weight:600; color:#323233; }
.reco-score { font-size:12px; color:#07c160; font-weight:600; margin-left:auto; }
.reco-skills { display:flex; gap:3px; flex-wrap:wrap; margin:4px 0; }
.reco-reason { font-size:11px; color:#969799; margin:4px 0; }
.reco-card .van-button { margin-top:6px; }

.vol-name { font-size:15px; font-weight:600; margin-left:4px; }
.actions { display:flex; gap:4px; padding:6px 12px; border-top:1px dashed #eee; flex-wrap:wrap; }
.match-note { font-size:12px; color:#646566; margin-top:4px; padding:4px 8px; background:#f7f8fa; border-radius:4px; }
.s11 { font-size:11px; } .muted { color:#969799; } .danger { color:#ee0a24; }
</style>
