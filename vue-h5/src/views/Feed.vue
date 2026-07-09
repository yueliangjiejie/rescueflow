<template>
  <div class="app-wrap">
    <van-nav-bar title="互助信息墙" left-arrow @click-left="$router.back()">
      <template #right>
        <van-icon name="orders-o" size="20" @click="$router.push('/my-matches')" />
      </template>
    </van-nav-bar>
    <div class="notice">
      群策群力 · 信息公开透明。<b>红色</b>=需要帮助,<b>绿色</b>=能提供帮助。可互相对接。
      <span class="link" @click="$router.push('/my-matches')">我的认领 →</span>
    </div>

    <!-- 筛选 + 排序 -->
    <van-cell-group inset>
      <van-cell>
        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          <van-tag v-for="k in kinds" :key="k.value" :type="filter.kind===k.value?'primary':'plain'" round size="large" @click="filter.kind=k.value; load()">
            {{ k.label }}
          </van-tag>
          <span style="flex:1"></span>
          <van-tag :type="filter.sort==='urgent'?'danger':'plain'" round size="large" @click="toggleSort">
            {{ filter.sort==='urgent' ? '⭐ 按紧急' : '🕐 按最新' }}
          </van-tag>
        </div>
      </van-cell>
      <van-field v-model="filter.category" placeholder="搜索类别:如 饮用水/船只/医生" @keyup.enter="load">
        <template #button><van-button size="small" @click="load">搜</van-button></template>
      </van-field>
    </van-cell-group>

    <!-- 信息列表 -->
    <div v-if="items.length" class="feed-list">
      <van-cell-group v-for="it in items" :key="it.code" inset class="feed-item" :class="it._kind">
        <van-cell>
          <template #title>
            <div class="feed-head">
              <van-tag :type="it._kind==='need'?'danger':'success'" size="medium">{{ it._kind==='need'?'需要':'能帮' }}</van-tag>
              <van-tag plain size="medium" style="margin-left:4px;">{{ it.typeLabel }}</van-tag>
              <span v-if="it.urgency==='critical'" class="danger" style="font-size:12px; margin-left:4px;">⚠紧急</span>
              <span v-if="it.resolved" style="color:#07c160; font-size:12px; margin-left:4px;">✓已脱险</span>
            </div>
            <div class="feed-title">{{ it.title }}</div>
            <div v-if="it.description" class="feed-desc">{{ it.description }}</div>
            <div class="feed-meta">
              <van-icon name="location-o" />{{ it.location || '位置未填' }}
              <span v-if="it.quantity" style="margin-left:8px;">· {{ it.quantity }} {{ it.unit }}</span>
              <span v-if="it.canDeliver" style="margin-left:8px; color:#07c160;">· 可配送</span>
            </div>
            <div class="feed-contact">
              <span class="muted">{{ it.name || '匿名' }}<span v-if="it.org">({{ it.org }})</span></span>
              <span v-if="it.phone" style="margin-left:8px;">{{ it.phone }}</span>
            </div>

            <!-- 对接状态/认领按钮 -->
            <div v-if="it._kind==='need' && !it.resolved" class="match-zone">
              <van-tag v-if="(it.claims?.length||0)>0" type="primary" size="medium">{{ it.claims.length }}人来帮</van-tag>
              <van-button v-if="!it.myMatch" size="small" type="success" plain icon="hand-down-o" style="margin-left:auto;"
                :loading="it._claiming" @click.stop="claim(it)">我来帮</van-button>
            </div>
            <!-- 认领人列表(展示联系方式,供需双方能真正联系上) -->
            <div v-if="it.claims && it.claims.length" class="claims-list">
              <div v-for="c in it.claims" :key="c.code" class="claim-item">
                <van-icon name="phone-o" color="#07c160" />
                <span class="claim-name">{{ c.fulfillerName }}</span>
                <span v-if="c.fulfillerOrg" class="muted s11">({{ c.fulfillerOrg }})</span>
                <a :href="'tel:'+c.fulfillerPhone" class="claim-phone">{{ c.fulfillerPhone }}</a>
                <van-tag :type="claimStatusType(c.status)" size="mini" style="margin-left:2px;">{{ matchLabel(c.status) }}</van-tag>
                <div v-if="c.note" class="muted s11 claim-note">{{ c.note }}</div>
              </div>
            </div>
            <!-- 我已认领的,显示推进按钮 -->
            <div v-if="it.myMatch" class="my-claim">
              <span class="s11">我已认领:{{ matchLabel(it.myMatch.status) }}</span>
              <van-button v-if="it.myMatch.status==='requested'" size="mini" type="success" @click.stop="adv(it,'accept')">接受</van-button>
              <van-button v-if="['accepted'].includes(it.myMatch.status)" size="mini" @click.stop="adv(it,'transit')">出发</van-button>
              <van-button v-if="['accepted','in_transit'].includes(it.myMatch.status)" size="mini" type="primary" @click.stop="adv(it,'deliver')">已送达</van-button>
              <van-button v-if="!['completed','cancelled'].includes(it.myMatch.status)" size="mini" type="success" @click.stop="adv(it,'complete')">完成</van-button>
            </div>
            <!-- 供给项:显示对接情况 -->
            <div v-else-if="it._kind==='offer'" class="match-zone">
              <van-tag v-if="it.status==='matched'" type="warning" size="medium">已匹配</van-tag>
              <van-tag v-else type="success" size="medium">可对接</van-tag>
            </div>

            <div class="muted feed-time">{{ fmt(it.createdAt) }}</div>
          </template>
        </van-cell>
      </van-cell-group>
    </div>
    <van-empty v-else-if="!loading" description="暂无信息,快来发布第一条" />

    <!-- 发布入口 -->
    <van-floating-bubble icon="plus" @click="showPublish = true" />

    <!-- 发布选择 -->
    <van-action-sheet v-model:show="showPublish" :actions="publishActions" cancel-text="取消" close-on-click-action @select="onPublish" />

    <!-- 认领弹窗(替代 window.prompt,手机端兼容) -->
    <van-dialog v-model:show="claimShow" title="我来帮忙" show-cancel-button :before-close="beforeClaimClose" confirm-button-text="确认认领">
      <div style="padding: 12px 16px;">
        <p class="muted s12" style="margin:0 0 10px;">需求方会看到您的联系方式,用于对接。请确保电话可接通。</p>
        <van-field v-model="claimForm.name" label="姓名" placeholder="您的称呼" left-icon="contact" required />
        <van-field v-model="claimForm.phone" label="电话" type="tel" placeholder="11位手机号" left-icon="phone-o" required />
        <van-field v-model="claimForm.org" label="组织" placeholder="可选,如:蓝天救援队" left-icon="friends-o" />
        <van-field v-model="claimForm.note" label="备注" type="textarea" rows="2" placeholder="可选,如:有车可运2吨物资" />
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { getFeed, createMatch, advanceMatch } from '../api/help.js';

const router = useRouter();
const items = ref([]);
const loading = ref(false);
const showPublish = ref(false);
const filter = reactive({ kind:'all', sort:'latest', category:'' });

const kinds = [
  { value:'all', label:'全部' },
  { value:'need', label:'需要帮助' },
  { value:'offer', label:'能帮什么' },
];

const TYPE_LABELS = { need:'求助', supplies:'物资', transport:'运力', service:'服务', venue:'场地' };

const publishActions = [
  { name:'登记求助', subname:'我需要帮助', color:'#ee0a24' },
  { name:'我能帮什么', subname:'我有物资/运力/服务' },
];

function onPublish(a) {
  if (a.name === '登记求助') router.push('/register');
  else router.push('/offer');
}

function toggleSort() {
  filter.sort = filter.sort === 'urgent' ? 'latest' : 'urgent';
  load();
}

async function load() {
  loading.value = true;
  try {
    const res = await getFeed({ kind: filter.kind, sort: filter.sort, category: filter.category });
    items.value = (res.data.items||[]).map(it => ({ ...it, typeLabel: TYPE_LABELS[it.type] || it.type || '求助', matchCount:0, inProgress:false, myMatch:null }));
    // 并行查询每条需求的对接情况(数量级小,可承受)
    const myId = localStorage.getItem('rf_uid') || ('u'+Date.now());
    const myPhone = localStorage.getItem('rf_phone') || '';
    localStorage.setItem('rf_uid', myId);
    await Promise.all(items.value.filter(it => it._kind==='need').map(async (it) => {
      try {
        // 用 claims(已在 feed 返回)判断我是否认领过
        const claims = it.claims || [];
        it.myMatch = myPhone ? claims.find(c => c.fulfillerPhone === myPhone && !['completed','cancelled'].includes(c.status)) : null;
      } catch {}
    }));
  } catch(e) { showToast('加载失败'); }
  finally { loading.value = false; }
}

const MATCH_LABELS = { requested:'待响应', accepted:'已接受', in_transit:'配送中', delivered:'已送达', completed:'已完成', cancelled:'已取消' };
const matchLabel = (s) => MATCH_LABELS[s] || s;
const claimStatusType = (s) => ({requested:'warning',accepted:'primary',in_transit:'success',delivered:'success',completed:'success',cancelled:'default'}[s]||'default');

// 认领弹窗(替代 window.prompt,手机端兼容)
const claimShow = ref(false);
const claimForm = reactive({ helpCode:'', helpTitle:'', name:'', phone:'', org:'', note:'' });

function claim(it) {
  // 预填:记住的信息直接带入,减少重复输入
  const savedPhone = localStorage.getItem('rf_phone') || '';
  const savedName = localStorage.getItem('rf_name') || '';
  claimForm.helpCode = it.code;
  claimForm.helpTitle = it.title || '';
  claimForm.name = savedName;
  claimForm.phone = savedPhone;
  claimForm.org = localStorage.getItem('rf_org') || '';
  claimForm.note = '';
  claimShow.value = true;
}

async function beforeClaimClose(action) {
  if (action !== 'confirm') return true;
  // 校验
  if (!claimForm.name.trim()) { showToast('请填写姓名'); return false; }
  if (!/^1[3-9]\d{9}$/.test(claimForm.phone)) { showToast('请输入正确的11位手机号'); return false; }
  // 提交
  try {
    const myId = localStorage.getItem('rf_uid') || ('u' + Date.now());
    localStorage.setItem('rf_uid', myId);
    const note = claimForm.note.trim() || (claimForm.org.trim() ? `${claimForm.org.trim()}·我来帮忙` : '我来帮忙');
    const res = await createMatch({
      helpCode: claimForm.helpCode,
      fulfillerId: myId,
      fulfillerName: claimForm.name.trim(),
      fulfillerPhone: claimForm.phone.trim(),
      fulfillerOrg: claimForm.org.trim(),
      note,
    });
    // 记住认领人信息,下次免填
    localStorage.setItem('rf_phone', claimForm.phone.trim());
    localStorage.setItem('rf_name', claimForm.name.trim());
    if (claimForm.org.trim()) localStorage.setItem('rf_org', claimForm.org.trim());
    // 更新本地列表
    const it = items.value.find(x => x.code === claimForm.helpCode);
    if (it) {
      it.myMatch = { code: res.data.code, status: 'requested' };
      if (!it.claims) it.claims = [];
      it.claims.unshift({ code: res.data.code, status: 'requested', fulfillerName: claimForm.name.trim(), fulfillerPhone: claimForm.phone.trim(), fulfillerOrg: claimForm.org.trim(), note });
    }
    showToast({ message: '认领成功!需求方会看到您的联系方式', duration: 2500 });
    claimShow.value = false;
    return true;
  } catch (e) { showToast(e.message || '认领失败'); return false; }
}

async function adv(it, action) {
  if (!it.myMatch) return;
  try {
    const res = await advanceMatch(it.myMatch.code, action, {});
    it.myMatch.status = res.data.status;
    it.matchStatus = matchLabel(res.data.status);
    showToast('已更新');
    if (res.data.status === 'completed' || res.data.status === 'cancelled') {
      setTimeout(load, 500);
    }
  } catch(e) { showToast(e.message || '操作失败'); }
}

const fmt = (t) => {
  if (!t) return '';
  const d = new Date(t);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff/60) + '分钟前';
  if (diff < 86400) return Math.floor(diff/3600) + '小时前';
  return d.toLocaleDateString('zh-CN');
};

onMounted(load);
</script>

<style scoped>
.feed-list { padding: 0 0 80px; }
.feed-item { margin-bottom: 8px; }
.feed-item.need :deep(.van-cell__title) { border-left: 3px solid #ee0a24; padding-left: 6px; }
.feed-item.offer :deep(.van-cell__title) { border-left: 3px solid #07c160; padding-left: 6px; }
.feed-head { display:flex; align-items:center; margin-bottom:4px; }
.feed-title { font-size:15px; font-weight:600; line-height:1.4; margin-bottom:2px; }
.feed-desc { font-size:13px; color:#646566; margin-bottom:4px; }
.feed-meta { font-size:12px; color:#969799; }
.feed-contact { font-size:13px; margin-top:4px; }
.match-zone { display:flex; align-items:center; flex-wrap:wrap; gap:4px; margin-top:6px; padding-top:6px; border-top:1px dashed #eee; }
.claims-list { margin-top:6px; background:#f6fff6; border-radius:4px; padding:6px 8px; }
.claim-item { display:flex; align-items:center; flex-wrap:wrap; gap:4px; padding:3px 0; font-size:13px; }
.claim-name { font-weight:600; }
.claim-phone { color:#1989fa; text-decoration:none; font-weight:600; }
.claim-phone:active { opacity:0.6; }
.claim-note { width:100%; padding-left:20px; }
.my-claim { display:flex; align-items:center; flex-wrap:wrap; gap:4px; margin-top:6px; padding:4px 8px; background:#ecf5ff; border-radius:4px; }
.s11 { font-size:11px; }
.s12 { font-size:12px; }
.feed-time { font-size:11px; margin-top:4px; }
.danger { color:#ee0a24; font-weight:600; }
.muted { color:#969799; }
.link { color:#1989fa; margin-left:4px; }
</style>
