<template>
  <div>
    <!-- 筛选 -->
    <el-card shadow="never" style="margin-bottom:12px;">
      <el-form inline>
        <el-form-item label="搜索">
          <el-input v-model="filter.q" clearable placeholder="编号/姓名/电话/摘要/地址" style="width:240px;" @keyup.enter="load" @clear="load" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filter.status" clearable placeholder="全部" style="width:120px;" @change="load">
            <el-option v-for="(l, v) in statusLabels" :key="v" :label="l" :value="v" />
          </el-select>
        </el-form-item>
        <el-form-item label="紧急度">
          <el-select v-model="filter.urgency" clearable placeholder="全部" style="width:120px;" @change="load">
            <el-option v-for="(l, v) in urgencyLabels" :key="v" :label="l" :value="v" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="load">搜索</el-button>
          <el-button @click="load">刷新</el-button>
          <el-button type="success" @click="doExport">导出 Excel</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never">
      <el-table :data="list" v-loading="loading" :row-class-name="rowClass" @row-click="goDetail" style="cursor:pointer;">
        <el-table-column prop="code" label="编号" width="200" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabels[row.status] }}</el-tag>
            <div v-if="row.abnormalReason" class="danger" style="font-size:11px;">{{ abnormalLabels[row.abnormalReason] }}</div>
          </template>
        </el-table-column>
        <el-table-column label="紧急度" width="80">
          <template #default="{ row }">
            <el-tag :type="urgencyType(row.urgency)" size="small" effect="dark">{{ urgencyLabels[row.urgency] }}</el-tag>
            <span v-if="row.slaBreached" class="danger" style="font-size:11px;">超时</span>
          </template>
        </el-table-column>
        <el-table-column label="可信度" width="90">
          <template #default="{ row }">{{ '★'.repeat(row.credibility) }}</template>
        </el-table-column>
        <el-table-column label="脱险" width="70">
          <template #default="{ row }">
            <el-tag v-if="row.resolved" type="success" size="small" effect="dark">✓脱险</el-tag>
            <span v-else class="danger">待援</span>
          </template>
        </el-table-column>
        <el-table-column label="认领" width="90">
          <template #default="{ row }">
            <span v-if="row.claimedBy" class="muted" style="font-size:11px;">{{ row.claimedBy }}</span>
            <el-button v-else size="small" link type="primary" @click.stop="doClaim(row)">认领</el-button>
          </template>
        </el-table-column>
        <el-table-column label="核实人" width="90">
          <template #default="{ row }">
            <span v-if="row.assignedVerifier" style="font-size:11px;">{{ row.assignedVerifier }}</span>
            <span v-else class="muted" style="font-size:11px;">未指派</span>
          </template>
        </el-table-column>
        <el-table-column label="特殊" width="60">
          <template #default="{ row }">
            <el-icon v-if="row.hasSpecialPerson" color="#f56c6c"><Warning /></el-icon>
          </template>
        </el-table-column>
        <el-table-column prop="person.phone" label="手机号" width="130" />
        <el-table-column label="摘要" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.content?.summary || row.content?.rawText }}</template>
        </el-table-column>
        <el-table-column label="地址" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.location?.address || row.location?.raw }}</template>
        </el-table-column>
        <el-table-column label="提交时间" width="150">
          <template #default="{ row }">{{ fmt(row.submittedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click.stop="goDetail(row)">详情</el-button>
            <el-button v-if="row.status==='pending'" size="small" type="primary" @click.stop="openVerify(row)">核实</el-button>
            <el-button v-if="row.status==='verified'" size="small" type="warning" @click.stop="openTransfer(row)">转交</el-button>
            <el-dropdown trigger="click" @command="(c)=>onMore(c,row)" style="margin-left:4px;">
              <el-button size="small" link>更多<el-icon><ArrowDown /></el-icon></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="assign" :disabled="row.status==='archived'">指派核实人</el-dropdown-item>
                  <el-dropdown-item command="done">标记完成</el-dropdown-item>
                  <el-dropdown-item command="resolve">标记脱险/成果</el-dropdown-item>
                  <el-dropdown-item command="abnormal">标记异常</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button size="small" link type="danger" @click.stop="onDelete(row)" title="删除">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        style="margin-top:12px; justify-content:flex-end;"
        v-model:current-page="filter.page"
        :page-size="filter.pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="load"
      />
    </el-card>

    <!-- 核实弹窗 -->
    <el-dialog v-model="verifyDlg" title="核实求助" width="420px">
      <el-form label-width="80px">
        <el-form-item label="可信度">
          <el-rate v-model="verifyForm.credibility" :max="5" />
        </el-form-item>
        <el-form-item label="紧急度">
          <el-select v-model="verifyForm.urgency" style="width:100%;">
            <el-option v-for="(l, v) in urgencyLabels" :key="v" :label="l" :value="v" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="verifyForm.note" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="verifyDlg=false">取消</el-button>
        <el-button type="primary" @click="doVerify">确认核实</el-button>
      </template>
    </el-dialog>

    <!-- 转交弹窗(从组织库选)-->
    <el-dialog v-model="transferDlg" title="转交承接方" width="460px">
      <el-form label-width="80px">
        <el-form-item label="转交给">
          <el-select v-model="transferForm.transferredTo" filterable placeholder="选择承接方/组织" style="width:100%;">
            <el-option v-for="o in orgs" :key="o.code" :label="o.name + (o.contactName?(' · '+o.contactName):'')" :value="o.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="联系方式">
          <div class="muted s12" v-if="selectedOrg">
            {{selectedOrg.contactName}} {{selectedOrg.contactPhone}}<span v-if="selectedOrg.contactWechat"> · 微信{{selectedOrg.contactWechat}}</span><br/>
            能力:{{(selectedOrg.capabilities||[]).join('、') || '-'}}
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="transferDlg=false">取消</el-button>
        <el-button type="primary" @click="doTransfer">确认转交</el-button>
      </template>
    </el-dialog>

    <!-- 指派核实人弹窗 -->
    <el-dialog v-model="assignDlg" title="指派核实人" width="420px">
      <el-form label-width="80px">
        <el-form-item label="核实人">
          <el-select v-model="assignForm.verifier" filterable placeholder="选择志愿者/操作员" style="width:100%;">
            <el-option v-for="u in verifiers" :key="u.username" :label="u.name + ' (' + roleLabel(u.role) + ')'" :value="u.username" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDlg=false">取消</el-button>
        <el-button type="primary" @click="doAssign">确认指派</el-button>
      </template>
    </el-dialog>

    <!-- 脱险 + 成果录入弹窗 -->
    <el-dialog v-model="resolveDlg" title="标记脱险 / 录入成果" width="440px">
      <el-form label-width="90px">
        <el-form-item label="是否脱险">
          <el-switch v-model="resolveForm.resolved" active-text="已脱险" inactive-text="未脱险" />
        </el-form-item>
        <el-form-item label="已转移人数">
          <el-input-number v-model="resolveForm.rescued" :min="0" />
        </el-form-item>
        <el-form-item label="已救治人数">
          <el-input-number v-model="resolveForm.treated" :min="0" />
        </el-form-item>
        <el-form-item label="失联人数">
          <el-input-number v-model="resolveForm.missing" :min="0" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="resolveForm.note" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resolveDlg=false">取消</el-button>
        <el-button type="success" @click="doResolve">确认记录</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import dayjs from 'dayjs';
import { listHelps, verify, transfer, markAbnormal, transition, exportUrl, claim, setResolved, listOrgs, listUsers, assignVerifier, deleteHelp } from '../api/admin.js';
import { URGENCY_LABELS, HELP_ABNORMAL_LABELS } from '@rescueflow/shared';

const router = useRouter();
const urgencyLabels = URGENCY_LABELS;
const abnormalLabels = HELP_ABNORMAL_LABELS;
const statusLabels = {
  pending: '待核实', verified: '已核实', transferred: '已转交',
  in_progress: '处理中', done: '已完成', archived: '已归档', abnormal: '异常',
};

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const filter = reactive({ status: '', urgency: '', q: '', page: 1, pageSize: 20 });

async function load() {
  loading.value = true;
  try {
    const params = { page: filter.page, pageSize: filter.pageSize };
    if (filter.status) params.status = filter.status;
    if (filter.urgency) params.urgency = filter.urgency;
    if (filter.q) params.q = filter.q;
    const res = await listHelps(params);
    list.value = res.data.items;
    total.value = res.data.total;
  } finally {
    loading.value = false;
  }
}

const statusType = (s) => ({
  pending: 'warning', verified: 'success', transferred: 'primary',
  in_progress: '', done: 'info', archived: 'info', abnormal: 'danger',
}[s] || '');

const urgencyType = (u) => ({
  critical: 'danger', high: 'warning', medium: '', low: 'info',
}[u] || '');

const fmt = (t) => (t ? dayjs(t).format('MM-DD HH:mm') : '');

const rowClass = ({ row }) => (row.slaBreached ? 'danger-row' : '');

const goDetail = (row) => router.push(`/helps/${row.code}`);

// 核实
const verifyDlg = ref(false);
const verifyForm = reactive({ code: '', credibility: 3, urgency: '', note: '' });
function openVerify(row) {
  verifyForm.code = row.code;
  verifyForm.credibility = row.credibility || 3;
  verifyForm.urgency = row.urgency;
  verifyForm.note = '';
  verifyDlg.value = true;
}
async function doVerify() {
  await verify(verifyForm.code, { credibility: verifyForm.credibility, urgency: verifyForm.urgency, note: verifyForm.note });
  ElMessage.success('已核实');
  verifyDlg.value = false;
  load();
}

// 转交(从组织库选)
const transferDlg = ref(false);
const transferForm = reactive({ code: '', transferredTo: '' });
const orgs = ref([]);
const selectedOrg = computed(() => orgs.value.find(o => o.name === transferForm.transferredTo));
function openTransfer(row) { transferForm.code = row.code; transferForm.transferredTo = ''; transferDlg.value = true; }
async function doTransfer() {
  if (!transferForm.transferredTo) return ElMessage.warning('请选择转交去向');
  await transfer(transferForm.code, { transferredTo: transferForm.transferredTo });
  ElMessage.success('已转交');
  transferDlg.value = false;
  load();
}

// 指派核实人
const assignDlg = ref(false);
const assignForm = reactive({ code: '', verifier: '' });
const verifiers = ref([]);
const roleLabel = (r) => ({volunteer:'志愿者',operator:'操作员',admin:'管理员'}[r]||r);
async function doAssign() {
  if (!assignForm.verifier) return ElMessage.warning('请选择核实人');
  await assignVerifier(assignForm.code, { verifier: assignForm.verifier });
  ElMessage.success('已指派核实人');
  assignDlg.value = false;
  load();
}

// 直接删除(常驻垃圾桶按钮)
async function onDelete(row) {
  await ElMessageBox.confirm(`确认删除 ${row.code}?此操作可恢复,但会从列表隐藏。`, '删除确认', { type: 'warning' });
  await deleteHelp(row.code);
  ElMessage.success('已删除(可恢复)');
  load();
}

// 更多/管理操作
async function onMore(cmd, row) {
  if (cmd === 'abnormal') {
    const { value } = await ElMessageBox.prompt('选择异常类型', '标记异常', {
      inputType: 'text', inputValue: 'duplicate',
      inputValidator: (v) => ['duplicate', 'false', 'out_of_scope', 'spam'].includes(v) || 'duplicate/false/out_of_scope/spam',
    });
    await markAbnormal(row.code, { reason: value });
    ElMessage.success('已标记异常');
    load();
  } else if (cmd === 'done') {
    await transition(row.code, { toStatus: 'done' });
    ElMessage.success('已完成');
    load();
  } else if (cmd === 'resolve') {
    openResolve(row);
  } else if (cmd === 'assign') {
    assignForm.code = row.code;
    assignForm.verifier = row.assignedVerifier || '';
    assignDlg.value = true;
  }
}

// 认领
async function doClaim(row) {
  await claim(row.code);
  ElMessage.success('已认领');
  load();
}

// 脱险 + 成果录入
const resolveDlg = ref(false);
const resolveForm = reactive({ code: '', resolved: true, rescued: 0, treated: 0, missing: 0, note: '' });
function openResolve(row) {
  resolveForm.code = row.code;
  resolveForm.resolved = true;
  resolveForm.rescued = row.outcome?.rescued || 0;
  resolveForm.treated = row.outcome?.treated || 0;
  resolveForm.missing = row.outcome?.missing || 0;
  resolveForm.note = row.outcome?.note || '';
  resolveDlg.value = true;
}
async function doResolve() {
  await setResolved(resolveForm.code, {
    resolved: resolveForm.resolved,
    rescued: resolveForm.rescued,
    treated: resolveForm.treated,
    missing: resolveForm.missing,
    note: resolveForm.note,
  });
  ElMessage.success('已记录');
  resolveDlg.value = false;
  load();
}

function doExport() {
  const params = {};
  if (filter.status) params.status = filter.status;
  if (filter.urgency) params.urgency = filter.urgency;
  window.open(exportUrl(params), '_blank');
}

onMounted(async () => {
  load();
  try {
    const [o, u] = await Promise.all([listOrgs(), listUsers()]);
    orgs.value = o.data || [];
    verifiers.value = (u.data || []).filter(x => ['volunteer','operator','admin'].includes(x.role) && x.active !== false);
  } catch {}
});
</script>
