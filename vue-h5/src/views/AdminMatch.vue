<template>
  <div class="app-wrap">
    <van-nav-bar title="供需对接" left-arrow @click-left="$router.back()" />

    <!-- 统计 -->
    <div class="stats" v-if="d.stats">
      <div class="stat"><div class="num danger">{{ d.stats.activeNeeds }}</div><div class="lab">活跃需求</div></div>
      <div class="stat"><div class="num success">{{ d.stats.activeOffers }}</div><div class="lab">可用供给</div></div>
      <div class="stat"><div class="num primary">{{ d.stats.inProgressMatches }}</div><div class="lab">对接中</div></div>
      <div class="stat"><div class="num" :class="{danger: d.stats.overdue>0}">{{ d.stats.overdue }}</div><div class="lab">超时</div></div>
    </div>

    <van-tabs v-model:active="tab">
      <van-tab title="智能撮合" name="match">
        <!-- 待撮合需求列表:点击展开候选供给 -->
        <div class="section">
          <div class="section-title">📋 待撮合需求（点击展开匹配供给）</div>
          <div v-if="needs.length" class="list">
            <van-cell-group v-for="h in needs" :key="h.code" inset class="item">
              <van-cell is-link @click="toggleExpand(h)">
                <template #title>
                  <div class="head">
                    <van-tag type="danger" size="medium">需求</van-tag>
                    <van-tag v-if="h.urgency==='critical'" type="danger" size="mini">紧急</van-tag>
                    <span class="muted s11" style="margin-left:auto;">{{ h.matchCount || 0 }}人帮</span>
                  </div>
                  <div class="code">{{ h.code }}</div>
                  <div class="summary">{{ h.content?.summary || h.content?.rawText || '(无描述)' }}</div>
                  <div class="meta"><van-icon name="location-o" />{{ h.location?.address || '位置未填' }}</div>
                </template>
              </van-cell>

              <!-- 展开的候选供给区 -->
              <div v-if="h._expanded" class="candidates">
                <div class="cand-title">匹配的供给（{{ h._candidates?.length || 0 }}）</div>
                <van-loading v-if="h._loading" size="20px" style="padding:12px;">匹配中...</van-loading>
                <div v-else-if="h._candidates?.length" class="cand-list">
                  <div v-for="o in h._candidates" :key="o.code" class="cand-card">
                    <div class="cand-head">
                      <van-tag :type="typeTag(o.type)" size="mini">{{ typeLabel(o.type) }}</van-tag>
                      <van-tag v-if="o._matchScore > 0" type="success" size="mini">匹配度 {{ o._matchScore }}</van-tag>
                      <span v-else class="muted s11">推荐</span>
                    </div>
                    <div class="cand-title-text">{{ o.title }}</div>
                    <div v-if="o.description" class="cand-desc">{{ o.description }}</div>
                    <div class="cand-meta">
                      <van-icon name="location-o" />{{ o.location || '位置未填' }}
                      <span v-if="o.quantity" style="margin-left:4px;">· {{ o.quantity }}{{ o.unit }}</span>
                    </div>
                    <div class="cand-meta"><van-icon name="phone-o" />{{ o.provider?.phone || '无电话' }} · {{ o.provider?.name || '匿名' }}</div>
                    <van-button size="small" type="primary" block :loading="o._matching" @click="doMatch(h, o)">撮合对接</van-button>
                  </div>
                </div>
                <van-empty v-else image-size="50" description="暂无可用供给" />
              </div>
            </van-cell-group>
          </div>
          <van-empty v-else image-size="60" description="暂无待撮合需求" />
        </div>
      </van-tab>

      <van-tab title="进行中对接" name="ongoing">
        <div class="section">
          <div class="section-title">
            进行中对接（{{ ongoing.length }}）
            <van-button size="mini" plain @click="load" style="float:right;">刷新</van-button>
          </div>
          <div v-if="ongoing.length" class="list">
            <van-cell-group v-for="m in ongoing" :key="m.code" inset class="item">
              <van-cell>
                <template #title>
                  <div class="head">
                    <van-tag :type="mStatusType(m.status)" size="medium">{{ mStatusLabel(m.status) }}</van-tag>
                    <span v-if="m.isOverdue" class="danger s11">⚠超时</span>
                    <span class="muted s11" style="margin-left:auto;">{{ fmt(m.requestedAt) }}</span>
                  </div>
                  <div class="code">需求 {{ m.helpCode }}</div>
                  <div v-if="m.offerCode" class="muted s12">供给 {{ m.offerCode }}</div>
                  <div class="muted s12">认领人 {{ m.fulfillerName || m.fulfillerId || '?' }} <a v-if="m.fulfillerPhone" :href="'tel:'+m.fulfillerPhone" class="call-link">{{ m.fulfillerPhone }}</a></div>
                  <div v-if="m.note" class="match-note">"{{ m.note }}"</div>
                  <div class="actions">
                    <van-button v-if="m.status==='requested'" size="small" type="success" @click="adv(m,'accept')">接受</van-button>
                    <van-button v-if="['accepted','requested'].includes(m.status)" size="small" type="primary" @click="adv(m,'transit')">配送</van-button>
                    <van-button v-if="['accepted','in_transit'].includes(m.status)" size="small" type="primary" @click="adv(m,'deliver')">送达</van-button>
                    <van-button v-if="!['completed','cancelled'].includes(m.status)" size="small" type="success" @click="adv(m,'complete')">完成</van-button>
                    <van-button v-if="!['completed','cancelled'].includes(m.status)" size="small" plain type="danger" @click="adv(m,'cancel')">取消</van-button>
                  </div>
                </template>
              </van-cell>
            </van-cell-group>
          </div>
          <van-empty v-else image-size="60" description="暂无进行中对接" />
        </div>
      </van-tab>
    </van-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { showToast, showSuccessToast } from 'vant';
import { getMatchDashboard, listMatches, matchOffers, createMatch, acceptMatch, markTransit, markDelivered, completeMatch, cancelMatch } from '../api/admin.js';
import { listHelps } from '../api/admin.js';

const tab = ref('match');
const d = reactive({ stats: {}, gaps: [], idle: [], pendingMatches: [] });
const needs = ref([]);
const ongoing = ref([]);

const typeLabel = (t) => ({ supplies:'物资', transport:'运力', service:'服务', venue:'场地' }[t] || t);
const typeTag = (t) => ({ supplies:'success', transport:'warning', service:'primary', venue:'' }[t] || '');
const mStatusLabel = (s) => ({ requested:'待响应', accepted:'已接受', in_transit:'配送中', delivered:'已送达', completed:'已完成', cancelled:'已取消' }[s] || s);
const mStatusType = (s) => ({ requested:'warning', accepted:'primary', in_transit:'', delivered:'success', completed:'success', cancelled:'default' }[s] || 'default');
const fmt = (t) => t ? new Date(t).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';

const ACTIONS = { accept:acceptMatch, transit:markTransit, deliver:markDelivered, complete:completeMatch, cancel:cancelMatch };

async function load() {
  try {
    const [db, mg, hl] = await Promise.all([getMatchDashboard(), listMatches({ pageSize: 100 }), listHelps({ pageSize: 50 })]);
    Object.assign(d, db.data);
    ongoing.value = (mg.data.items || []).filter(m => !['completed','cancelled'].includes(m.status));
    // 待撮合需求 = 已核实/处理中的活跃求助
    needs.value = (hl.data.items || [])
      .filter(h => ['verified','in_progress'].includes(h.status))
      .map(h => ({ ...h, _expanded:false, _loading:false, _candidates:[] }));
  } catch (e) { showToast(e.message || '加载失败'); }
}

// 展开需求,加载匹配的候选供给
async function toggleExpand(h) {
  h._expanded = !h._expanded;
  if (h._expanded && !h._candidates.length) {
    h._loading = true;
    try {
      const res = await matchOffers(h.code);
      h._candidates = (res.data.matches || []).map(o => ({ ...o, _matching:false }));
    } catch (e) { showToast(e.message || '匹配失败'); }
    finally { h._loading = false; }
  }
}

// 撮合:为需求发起对接(用供给方的信息作为认领人)
async function doMatch(h, o) {
  o._matching = true;
  try {
    await createMatch({
      helpCode: h.code,
      offerCode: o.code,
      fulfillerId: o.provider?.name || 'admin-match',
      fulfillerName: o.provider?.name || '管理员撮合',
      fulfillerPhone: o.provider?.phone || '',
      fulfillerOrg: o.provider?.org || '',
      note: `管理员撮合:将【${o.title}】对接到【${h.content?.summary?.slice(0,20)||h.code}】`,
    });
    showSuccessToast('撮合成功');
    h._expanded = false;
    tab.value = 'ongoing';
    load();
  } catch (e) { showToast(e.message || '撮合失败'); }
  finally { o._matching = false; }
}

async function adv(m, action) {
  try {
    await ACTIONS[action](m.code);
    showSuccessToast('已更新');
    load();
  } catch (e) { showToast(e.message || '操作失败'); }
}

onMounted(load);
</script>

<style scoped>
.stats { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; padding:12px; }
.stat { background:#fff; border-radius:8px; padding:10px 4px; text-align:center; }
.num { font-size:22px; font-weight:700; color:#323233; }
.num.danger { color:#ee0a24; } .num.success { color:#07c160; } .num.primary { color:#1989fa; }
.lab { font-size:11px; color:#969799; margin-top:2px; }

.section { padding: 4px 12px 12px; }
.section-title { font-size:14px; font-weight:600; margin:8px 0; color:#323233; }
.list .item { margin-bottom: 8px; }
.head { display:flex; align-items:center; gap:4px; margin-bottom:4px; }
.code { font-size:12px; color:#1989fa; font-weight:600; }
.summary { font-size:14px; color:#323233; margin:4px 0; line-height:1.5; }
.meta { font-size:12px; color:#969799; margin-top:2px; }
.actions { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }

/* 候选供给区 */
.candidates { background:#f7f8fa; padding: 8px 12px; border-top:1px dashed #ddd; }
.cand-title { font-size:12px; font-weight:600; color:#646566; margin-bottom:6px; }
.cand-list { display:flex; flex-direction:column; gap:8px; }
.cand-card { background:#fff; border-radius:8px; padding:10px; border-left:3px solid #07c160; }
.cand-head { display:flex; align-items:center; gap:4px; margin-bottom:4px; }
.cand-title-text { font-size:14px; font-weight:600; color:#323233; }
.cand-desc { font-size:12px; color:#646566; margin:4px 0; }
.cand-meta { font-size:11px; color:#969799; margin-top:2px; }
.cand-card .van-button { margin-top:8px; }

.call-link { color:#1989fa; text-decoration:none; }
.match-note { font-size:12px; color:#646566; margin-top:4px; padding:4px 8px; background:#f7f8fa; border-radius:4px; }
.s11 { font-size:11px; } .s12 { font-size:12px; }
.muted { color:#969799; } .danger { color:#ee0a24; }
</style>
