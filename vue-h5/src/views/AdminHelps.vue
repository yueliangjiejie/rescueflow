<template>
  <div class="app-wrap">
    <van-nav-bar title="求助审批" left-arrow @click-left="$router.back()" />

    <!-- 状态筛选 -->
    <van-tabs v-model:active="filter.status" @change="load">
      <van-tab v-for="s in statuses" :key="s.value" :name="s.value" :title="s.label" />
    </van-tabs>

    <!-- 搜索 -->
    <van-search v-model="filter.q" placeholder="搜索编号/姓名/电话/摘要" @search="load" shape="round" />

    <!-- 列表 -->
    <div v-if="list.length" class="list">
      <van-cell-group v-for="h in list" :key="h.code" inset class="item">
        <van-cell>
          <template #title>
            <div class="head">
              <van-tag :type="statusType(h.status)" size="medium">{{ statusLabel(h.status) }}</van-tag>
              <van-tag v-if="h.urgency==='critical'" type="danger" size="mini">紧急</van-tag>
              <van-tag v-else-if="h.urgency==='high'" type="warning" size="mini">紧迫</van-tag>
              <span v-if="h.slaBreached" class="danger s11">⚠超时</span>
              <span class="muted s11" style="margin-left:auto;">{{ fmt(h.submittedAt) }}</span>
            </div>
            <div class="code">{{ h.code }}</div>
            <div class="summary">{{ h.content?.summary || h.content?.rawText || '(无描述)' }}</div>
            <div class="meta">
              <van-icon name="location-o" />{{ h.location?.address || h.location?.raw || '位置未填' }}
            </div>
            <!-- 联系电话:管理员点击查看明文 + 拨打(列表默认脱敏) -->
            <div class="phone-row">
              <van-icon name="phone-o" />
              <span v-if="h._plainPhone" class="plain-phone">{{ h._plainPhone }}</span>
              <span v-else class="muted">{{ h.person?.phone || '无电话' }}</span>
              <van-button v-if="!h._plainPhone && h.person?.phone" size="mini" plain type="primary" :loading="h._revealing" @click="reveal(h)">查看明文</van-button>
              <template v-if="h._plainPhone">
                <a :href="'tel:' + h._plainPhone" class="call-btn"><van-icon name="phone" /> 拨打</a>
                <span v-if="h._plainName" class="muted s12">· {{ h._plainName }}</span>
              </template>
            </div>
            <div v-if="h.person?.specialPersons?.length" class="meta">
              <van-tag v-for="s in h.person.specialPersons" :key="s" type="warning" size="mini">{{ spLabel(s) }}</van-tag>
            </div>
          </template>
        </van-cell>

        <!-- 操作按钮 -->
        <div class="actions" v-if="h.status==='pending' || h.status==='verified'">
          <van-button v-if="h.status==='pending'" size="small" type="primary" :loading="h._acting" @click="act(h,'verify')">核实通过</van-button>
          <van-button v-if="h.status==='verified'" size="small" type="warning" :loading="h._acting" @click="act(h,'transfer')">转交</van-button>
          <van-button size="small" type="success" :loading="h._acting" @click="act(h,'transition','done')">标记完成</van-button>
        </div>
      </van-cell-group>
    </div>
    <van-empty v-else-if="!loading" description="暂无求助" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { showToast, showSuccessToast } from 'vant';
import { listHelps, helpAction, revealHelp } from '../api/admin.js';
import { SPECIAL_PERSON_LABELS } from '@rescueflow/shared';

const list = ref([]);
const loading = ref(false);
const filter = reactive({ status: 'pending', q: '' });

const statuses = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待核实' },
  { value: 'verified', label: '已核实' },
  { value: 'in_progress', label: '处理中' },
  { value: 'done', label: '已完成' },
];
const statusLabel = (s) => ({ pending:'待核实', verified:'已核实', transferred:'已转交', in_progress:'处理中', done:'已完成', abnormal:'异常' }[s] || s);
const statusType = (s) => ({ pending:'warning', verified:'success', transferred:'primary', in_progress:'', done:'default', abnormal:'danger' }[s] || 'default');
const spLabel = (s) => SPECIAL_PERSON_LABELS[s] || s;
const fmt = (t) => t ? new Date(t).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';

async function load() {
  loading.value = true;
  try {
    const params = { page: 1, pageSize: 30 };
    if (filter.status) params.status = filter.status;
    if (filter.q) params.q = filter.q;
    const res = await listHelps(params);
    list.value = (res.data.items || []).map(h => ({ ...h, _acting: false, _revealing: false, _plainPhone: '', _plainName: '' }));
  } catch (e) { showToast(e.message || '加载失败'); }
  finally { loading.value = false; }
}

async function act(h, action, toStatus) {
  h._acting = true;
  try {
    const body = {};
    if (action === 'transition' && toStatus) body.toStatus = toStatus;
    await helpAction(h.code, action, body);
    showSuccessToast('操作成功');
    load();
  } catch (e) { showToast(e.message || '操作失败'); }
  finally { h._acting = false; }
}

// 查看明文联系方式(管理员核实用,后端留痕记录)
async function reveal(h) {
  h._revealing = true;
  try {
    const res = await revealHelp(h.code);
    h._plainPhone = res.data?.phone || '';
    h._plainName = res.data?.name || '';
    if (!h._plainPhone) showToast('无电话');
  } catch (e) { showToast(e.message || '查看失败'); }
  finally { h._revealing = false; }
}

onMounted(load);
</script>

<style scoped>
.list { padding-bottom: 20px; }
.item { margin-bottom: 8px; }
.head { display:flex; align-items:center; gap:4px; margin-bottom:4px; }
.code { font-size:12px; color:#1989fa; font-weight:600; }
.summary { font-size:14px; color:#323233; margin: 4px 0; line-height:1.5; }
.meta { font-size:12px; color:#969799; margin-top:4px; }
.phone-row { display:flex; align-items:center; gap:6px; margin-top:6px; font-size:13px; flex-wrap:wrap; }
.plain-phone { font-weight:600; color:#ee0a24; font-size:15px; letter-spacing:0.5px; }
.call-btn { color:#07c160; text-decoration:none; font-weight:600; border:1px solid #07c160; border-radius:4px; padding:2px 8px; font-size:12px; }
.call-btn:active { opacity:0.6; }
.actions { display:flex; gap:6px; padding: 8px 12px; border-top: 1px dashed #eee; flex-wrap:wrap; }
.s11 { font-size:11px; }
.muted { color:#969799; } .danger { color:#ee0a24; }
</style>
