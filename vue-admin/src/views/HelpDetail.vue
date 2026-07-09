<template>
  <div v-loading="loading">
    <el-page-header @back="$router.back()" :content="help?.code || '详情'" style="margin-bottom:12px;" />

    <el-row :gutter="12">
      <el-col :span="16">
        <el-card shadow="never" v-if="help">
          <template #header>
            <span style="font-weight:600;">{{ help.code }}</span>
            <el-tag :type="statusType(help.status)" size="small" style="margin-left:8px;">{{ statusLabels[help.status] }}</el-tag>
            <el-tag v-if="help.abnormalReason" type="danger" size="small">{{ abnormalLabels[help.abnormalReason] }}</el-tag>
            <el-tag v-if="help.slaBreached" type="danger" size="small" effect="dark">已超时</el-tag>
            <el-tag :type="urgencyType(help.urgency)" size="small" effect="dark" style="margin-left:8px;">{{ urgencyLabels[help.urgency] }}</el-tag>
          </template>

          <el-descriptions :column="2" border>
            <el-descriptions-item label="可信度">{{ '★'.repeat(help.credibility) }}</el-descriptions-item>
            <el-descriptions-item label="受困人数">{{ help.person?.headcount }}</el-descriptions-item>
            <el-descriptions-item label="姓名">{{ help.person?.name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="手机号">
              {{ help.person?.phone }}
              <el-button link type="primary" size="small" @click="doReveal" v-if="!revealed">查看明文(留痕)</el-button>
            </el-descriptions-item>
            <el-descriptions-item label="特殊人员" :span="2">
              <el-tag v-for="s in (help.person?.specialPersons||[])" :key="s" type="danger" size="small" style="margin-right:4px;">{{ specialLabels[s] }}</el-tag>
              <span v-if="!help.person?.specialPersons?.length" class="muted">无</span>
            </el-descriptions-item>
            <el-descriptions-item label="摘要" :span="2">{{ help.content?.summary || help.content?.rawText }}</el-descriptions-item>
            <el-descriptions-item label="地址" :span="2">{{ help.location?.address || help.location?.raw }}</el-descriptions-item>
            <el-descriptions-item label="登记方式">{{ methodLabels[help.method] }}</el-descriptions-item>
            <el-descriptions-item label="登记主体">{{ help.reporterRelation==='self'?'本人':'代他人' }}</el-descriptions-item>
            <el-descriptions-item label="提交时间" :span="2">{{ fmt(help.submittedAt) }}</el-descriptions-item>
            <el-descriptions-item label="转交去向" :span="2">{{ help.transferredTo || '-' }}</el-descriptions-item>
            <el-descriptions-item v-if="help.ai?.degraded" label="AI" :span="2">
              <el-tag type="warning" size="small">已降级(AI/地图未就绪,人工处理)</el-tag>
            </el-descriptions-item>
          </el-descriptions>

          <div style="margin-top:16px;">
            <el-button v-if="help.status==='pending'" type="primary" @click="$router.push('/helps')">去列表核实</el-button>
          </div>
        </el-card>

        <!-- 对接情况 + 推荐供给方 -->
        <el-card shadow="never" style="margin-top:12px;" v-if="help">
          <template #header>
            <span>🤝 对接情况</span>
            <el-button link type="success" style="float:right" @click="openClaimDlg">+ 我来认领 / 派人对接</el-button>
          </template>

          <!-- 已认领的人(带联系方式,可点击拨号)-->
          <div v-if="helpMatches.length" style="margin-bottom:12px;">
            <div class="muted s12" style="margin-bottom:6px;">已认领({{ helpMatches.length }}人)</div>
            <div v-for="m in helpMatches" :key="m.code" class="claimer-row">
              <el-icon color="#07c160"><Phone /></el-icon>
              <b>{{ m.fulfillerName }}</b>
              <span v-if="m.fulfillerOrg" class="muted s12">({{ m.fulfillerOrg }})</span>
              <a :href="'tel:'+m.fulfillerPhone" class="phone-link">{{ m.fulfillerPhone }}</a>
              <el-tag :type="matchTagType(m.status)" size="small">{{ matchLabel(m.status) }}</el-tag>
              <span v-if="m.isOverdue" class="danger s12">⚠超时</span>
              <div v-if="m.note" class="muted s12" style="width:100%;margin-left:20px;">{{ m.note }}</div>
            </div>
          </div>
          <el-alert v-else type="info" :closable="false" style="margin-bottom:12px;">
            还没有人认领。点击右上角"我来认领/派人对接",留下联系方式,需求方就能联系您。
          </el-alert>

          <!-- 推荐可对接的供给方(从互助墙)-->
          <div class="muted s12" style="margin-bottom:6px;">推荐可对接的供给方(来自互助墙)</div>
          <el-empty v-if="!suggestedOffers.length" :image-size="40" description="暂无可推荐的供给方" />
          <div v-for="o in suggestedOffers" :key="o.code" class="offer-row">
            <div style="flex:1;">
              <el-tag :type="offerTagType(o.type)" size="small">{{ offerLabel(o.type) }}</el-tag>
              <b style="margin-left:4px;">{{ o.title }}</b>
              <span v-if="o.quantity" class="muted s12"> · {{o.quantity}}{{o.unit}}</span>
              <div class="muted s12">{{ o.location }}<span v-if="o.name"> · {{o.name}}</span><span v-if="o.org">({{o.org}})</span></div>
            </div>
            <el-button size="small" type="success" :loading="o._linking" @click="linkOffer(o)">联系并指派</el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="never" header="操作留痕(哈希链)">
          <el-timeline v-if="audit.length">
            <el-timeline-item
              v-for="log in audit"
              :key="log.seq"
              :timestamp="fmt(log.createdAt)"
              :type="logType(log.action)"
            >
              <div><b>{{ actionLabels[log.action] || log.action }}</b></div>
              <div class="muted">{{ log.summary }}</div>
              <div class="muted" style="font-size:11px;">{{ log.actorId }} · #{{ log.seq }}</div>
              <div class="muted" style="font-size:10px; word-break:break-all;">{{ log.hash?.slice(0,16) }}…</div>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="暂无留痕" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 我来认领弹窗 -->
    <el-dialog v-model="claimDlg" title="我来认领 / 派人对接" width="440px">
      <el-alert type="info" :closable="false" style="margin-bottom:12px;">
        填写联系方式后,需求方(求助人)会看到并联系您。
      </el-alert>
      <el-form label-width="80px">
        <el-form-item label="认领人"><el-input v-model="claimForm.fulfillerName" placeholder="姓名" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="claimForm.fulfillerPhone" placeholder="11位手机号" /></el-form-item>
        <el-form-item label="组织"><el-input v-model="claimForm.fulfillerOrg" placeholder="如:蓝天救援队(可选)" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="claimForm.note" type="textarea" :rows="2" placeholder="如:有2艘冲锋舟,30分钟后到" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="claimDlg=false">取消</el-button>
        <el-button type="success" @click="doClaim">确认认领</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';
import { getHelp, getAudit, reveal, matchOffers, createMatch, listMatches } from '../api/admin.js';
import { Phone } from '@element-plus/icons-vue';
import { URGENCY_LABELS, HELP_ABNORMAL_LABELS, SPECIAL_PERSON_LABELS } from '@rescueflow/shared';

const props = defineProps({ code: { type: String, required: true } });

const loading = ref(false);
const help = ref(null);
const audit = ref([]);
const revealed = ref(false);

// 推荐供给 & 对接
const matching = ref(false);
const suggestedOffers = ref([]);
const helpMatches = ref([]);

const offerLabel = (t) => ({supplies:'物资',transport:'运力',service:'服务',venue:'场地'}[t]||t);
const offerTagType = (t) => ({supplies:'success',transport:'warning',service:'primary',venue:'info'}[t]||'');
const matchLabel = (s) => ({requested:'待响应',accepted:'已接受',in_transit:'配送中',delivered:'已送达',completed:'已完成',cancelled:'已取消'}[s]||s);
const matchTagType = (s) => ({requested:'warning',accepted:'primary',in_transit:'',delivered:'success',completed:'success',cancelled:'info'}[s]||'');

const urgencyLabels = URGENCY_LABELS;
const abnormalLabels = HELP_ABNORMAL_LABELS;
const specialLabels = SPECIAL_PERSON_LABELS;
const statusLabels = { pending:'待核实', verified:'已核实', transferred:'已转交', in_progress:'处理中', done:'已完成', archived:'已归档', abnormal:'异常' };
const methodLabels = { voice:'语音', manual:'手动', image:'图片识别' };
const actionLabels = { create:'登记', update:'修改', transition:'状态流转', verify:'核实', transfer:'转交', export:'导出', delete:'删除', ai_process:'AI处理', view:'查看敏感信息' };

const statusType = (s) => ({ pending:'warning', verified:'success', transferred:'primary', in_progress:'', done:'info', archived:'info', abnormal:'danger' }[s]||'');
const urgencyType = (u) => ({ critical:'danger', high:'warning', medium:'', low:'info' }[u]||'');
const logType = (a) => ({ create:'primary', verify:'success', transfer:'warning', view:'info' }[a]||'');
const fmt = (t) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '');

async function load() {
  loading.value = true;
  try {
    const [h, a] = await Promise.all([getHelp(props.code), getAudit(props.code)]);
    help.value = h.data;
    audit.value = a.data || [];
  } finally {
    loading.value = false;
  }
}

async function doReveal() {
  const res = await reveal(props.code);
  help.value.person.phone = res.data.phone;
  help.value.person.name = res.data.name;
  revealed.value = true;
}

async function loadMatches() {
  matching.value = true;
  try {
    const [mo, ml] = await Promise.all([
      matchOffers(props.code),
      listMatches({ helpCode: props.code }),
    ]);
    suggestedOffers.value = (mo.data.matches || []).map(o => ({ ...o, _linking: false }));
    helpMatches.value = (ml.data.items || ml.data || []).filter(m => !['completed','cancelled'].includes(m.status));
  } finally { matching.value = false; }
}

async function linkOffer(o) {
  o._linking = true;
  try {
    // 指派供给方 = 用供给方信息创建认领
    await createMatch({
      helpCode: props.code,
      offerCode: o.code,
      fulfillerName: o.name || '供给方',
      fulfillerPhone: o.phone || '00000000000',
      fulfillerOrg: o.org || '',
      note: `指派供给:${o.title}`,
    });
    ElMessage.success('已指派,需求方会看到联系方式');
    await loadMatches();
  } catch(e) { ElMessage.error(e.message || '指派失败'); }
  finally { o._linking = false; }
}

// 我来认领
const claimDlg = ref(false);
const claimForm = reactive({ fulfillerName:'', fulfillerPhone:'', fulfillerOrg:'', note:'' });
function openClaimDlg() {
  claimForm.fulfillerName = ''; claimForm.fulfillerPhone = ''; claimForm.fulfillerOrg = ''; claimForm.note = '';
  claimDlg.value = true;
}
async function doClaim() {
  if (!claimForm.fulfillerName || !/^1[3-9]\d{9}$/.test(claimForm.fulfillerPhone)) {
    return ElMessage.warning('请填写姓名和正确手机号');
  }
  try {
    await createMatch({ helpCode: props.code, ...claimForm });
    ElMessage.success('认领成功,需求方会看到您的联系方式');
    claimDlg.value = false;
    await loadMatches();
  } catch(e) { ElMessage.error(e.message || '认领失败'); }
}

onMounted(async () => {
  await load();
  loadMatches();
});
</script>

<style scoped>
.s12 { font-size:12px; }
.offer-row { display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px dashed #eee; }
.claimer-row { display:flex; align-items:center; flex-wrap:wrap; gap:6px; padding:8px 0; border-bottom:1px dashed #e0f0e0; }
.phone-link { color:#1989fa; text-decoration:none; font-weight:600; }
.danger { color:#f56c6c; }
</style>
