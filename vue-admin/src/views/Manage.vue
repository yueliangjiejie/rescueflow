<template>
  <div>
    <el-tabs v-model="active">
      <!-- 用户/角色管理 -->
      <el-tab-pane label="用户与角色" name="users">
        <el-card shadow="never" style="margin-bottom:10px;">
          <el-button type="primary" @click="openUser()">+ 新增用户</el-button>
          <el-input v-model="userQ" placeholder="搜索用户名/姓名/电话" clearable style="width:220px; margin-left:8px;" @keyup.enter="loadUsers" />
          <el-button @click="loadUsers">查</el-button>
        </el-card>
        <el-card shadow="never">
          <el-table :data="users" size="small">
            <el-table-column prop="username" label="用户名" width="120" />
            <el-table-column prop="name" label="姓名" width="100" />
            <el-table-column prop="phone" label="电话" width="130" />
            <el-table-column label="角色" width="110">
              <template #default="{row}">
                <el-select v-model="row.role" size="small" @change="changeRole(row)">
                  <el-option label="志愿者" value="volunteer" />
                  <el-option label="操作员" value="operator" />
                  <el-option label="管理员" value="admin" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80">
              <template #default="{row}"><el-tag :type="row.active?'success':'info'" size="small">{{row.active?'正常':'停用'}}</el-tag></template>
            </el-table-column>
            <el-table-column label="操作" width="200">
              <template #default="{row}">
                <el-button size="small" link @click="openUser(row)">编辑</el-button>
                <el-button size="small" link type="warning" @click="resetPwd(row)">重置密码</el-button>
                <el-button size="small" link type="danger" @click="toggleUser(row)">{{row.active?'停用':'启用'}}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 承接方/组织 -->
      <el-tab-pane label="承接方/组织" name="orgs">
        <el-card shadow="never" style="margin-bottom:10px;">
          <el-button type="primary" @click="openOrg()">+ 新增组织</el-button>
          <el-button @click="loadOrgs">刷新</el-button>
        </el-card>
        <el-card shadow="never">
          <el-table :data="orgs" size="small">
            <el-table-column prop="name" label="名称" min-width="140" />
            <el-table-column label="类型" width="100">
              <template #default="{row}"><el-tag size="small">{{typeLabel(row.type)}}</el-tag></template>
            </el-table-column>
            <el-table-column prop="contactName" label="联系人" width="90" />
            <el-table-column prop="contactPhone" label="电话" width="130" />
            <el-table-column label="能力" min-width="140">
              <template #default="{row}"><el-tag v-for="c in (row.capabilities||[])" :key="c" size="small" style="margin:1px;">{{c}}</el-tag></template>
            </el-table-column>
            <el-table-column prop="serviceArea" label="服务区域" width="100" />
            <el-table-column label="状态" width="80">
              <template #default="{row}"><el-tag :type="row.active?'success':'info'" size="small">{{row.active?'可用':'停用'}}</el-tag></template>
            </el-table-column>
            <el-table-column label="操作" width="130">
              <template #default="{row}">
                <el-button size="small" link @click="openOrg(row)">编辑</el-button>
                <el-button size="small" link type="danger" @click="delOrg(row)">停用</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 志愿者审批 -->
      <el-tab-pane label="志愿者审批" name="apps">
        <el-card shadow="never" style="margin-bottom:10px;">
          <el-radio-group v-model="appStatus" @change="loadApps">
            <el-radio-button :label="undefined">全部</el-radio-button>
            <el-radio-button :label="0">待审</el-radio-button>
            <el-radio-button :label="1">已通过</el-radio-button>
            <el-radio-button :label="2">已拒绝</el-radio-button>
          </el-radio-group>
        </el-card>
        <el-card shadow="never">
          <el-empty v-if="!apps.length" description="暂无申请" />
          <div v-for="a in apps" :key="a._id" class="app-row">
            <div style="flex:1;">
              <b>{{ a.userId?.name || a.userId?.username }}</b>
              <span class="muted s12"> {{ a.userId?.phone }} </span>
              <el-tag :type="appStatusType(a.applicationStatus)" size="small" style="margin-left:6px;">{{appStatusLabel(a.applicationStatus)}}</el-tag>
              <div class="muted s12">技能:{{(a.skills||[]).join('、') || '未填'}} · 区域:{{a.serviceArea?.address||'未填'}}</div>
            </div>
            <div v-if="a.applicationStatus===0">
              <el-button size="small" type="success" @click="doApprove(a, true)">通过</el-button>
              <el-button size="small" type="danger" @click="doApprove(a, false)">拒绝</el-button>
            </div>
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 用户弹窗 -->
    <el-dialog v-model="userDlg" :title="userForm._id?'编辑用户':'新增用户'" width="420px">
      <el-form label-width="70px">
        <el-form-item label="用户名"><el-input v-model="userForm.username" :disabled="!!userForm._id" /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="userForm.name" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="userForm.phone" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="userForm.role" style="width:100%;">
            <el-option label="志愿者(可核实/认领)" value="volunteer" />
            <el-option label="操作员(全部业务+导出)" value="operator" />
            <el-option label="管理员(含用户管理)" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!userForm._id" label="初始密码"><el-input v-model="userForm.password" placeholder="默认 123456" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userDlg=false">取消</el-button>
        <el-button type="primary" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>

    <!-- 组织弹窗 -->
    <el-dialog v-model="orgDlg" :title="orgForm._id?'编辑组织':'新增组织'" width="480px">
      <el-form label-width="70px">
        <el-form-item label="名称"><el-input v-model="orgForm.name" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="orgForm.type" style="width:100%;">
            <el-option v-for="(l,v) in typeLabels" :key="v" :label="l" :value="v" />
          </el-select>
        </el-form-item>
        <el-form-item label="联系人"><el-input v-model="orgForm.contactName" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="orgForm.contactPhone" /></el-form-item>
        <el-form-item label="微信"><el-input v-model="orgForm.contactWechat" /></el-form-item>
        <el-form-item label="地址"><el-input v-model="orgForm.address" /></el-form-item>
        <el-form-item label="能力"><el-input v-model="orgForm.capabilitiesStr" placeholder="逗号分隔,如:水域救援,医疗" /></el-form-item>
        <el-form-item label="服务区"><el-input v-model="orgForm.serviceArea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="orgDlg=false">取消</el-button>
        <el-button type="primary" @click="saveOrg">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  listUsers, createUser, updateUser, deleteUser,
  listOrgs, createOrg, updateOrg, deleteOrg,
  listVolunteerApps,
} from '../api/admin.js';

const active = ref('users');
const users = ref([]);
const orgs = ref([]);
const apps = ref([]);
const userQ = ref('');
const appStatus = ref(undefined);

const typeLabels = { rescue_team:'救援队', ngo:'公益组织', government:'政府部门', enterprise:'企业', medical:'医疗机构', other:'其他' };
const typeLabel = (t) => typeLabels[t] || t;
const appStatusLabel = (s) => ({0:'待审',1:'已通过',2:'已拒绝'}[s]);
const appStatusType = (s) => ({0:'warning',1:'success',2:'danger'}[s]||'info');

async function loadUsers() {
  const r = await listUsers({ q: userQ.value });
  users.value = r.data || [];
}
async function loadOrgs() {
  const r = await listOrgs();
  orgs.value = r.data || [];
}
async function loadApps() {
  const r = await listVolunteerApps({ status: appStatus.value });
  apps.value = r.data || [];
}

// 用户
const userDlg = ref(false);
const userForm = reactive({});
function openUser(row) {
  Object.keys(userForm).forEach(k => delete userForm[k]);
  if (row) Object.assign(userForm, row);
  else Object.assign(userForm, { username:'', name:'', phone:'', role:'volunteer', password:'' });
  userDlg.value = true;
}
async function saveUser() {
  if (userForm._id) {
    await updateUser(userForm._id, { name: userForm.name, phone: userForm.phone, role: userForm.role });
  } else {
    await createUser(userForm);
  }
  ElMessage.success('已保存');
  userDlg.value = false;
  loadUsers();
}
async function changeRole(row) {
  await updateUser(row._id, { role: row.role });
  ElMessage.success('角色已更新');
}
async function resetPwd(row) {
  const { value } = await ElMessageBox.prompt('输入新密码', '重置密码', { inputValue: '123456' });
  await import('../api/http.js').then(({default: http}) => http.post(`/api/users/${row._id}/reset-password`, { password: value }));
  ElMessage.success('已重置');
}
async function toggleUser(row) {
  await updateUser(row._id, { active: !row.active });
  loadUsers();
}

// 组织
const orgDlg = ref(false);
const orgForm = reactive({});
function openOrg(row) {
  Object.keys(orgForm).forEach(k => delete orgForm[k]);
  if (row) Object.assign(orgForm, { ...row, capabilitiesStr: (row.capabilities||[]).join(',') });
  else Object.assign(orgForm, { name:'', type:'rescue_team', contactName:'', contactPhone:'', contactWechat:'', address:'', capabilitiesStr:'', serviceArea:'' });
  orgDlg.value = true;
}
async function saveOrg() {
  const body = {
    ...orgForm,
    capabilities: (orgForm.capabilitiesStr||'').split(',').map(s=>s.trim()).filter(Boolean),
  };
  delete body.capabilitiesStr;
  if (orgForm._id) await updateOrg(orgForm._id, body);
  else await createOrg(body);
  ElMessage.success('已保存');
  orgDlg.value = false;
  loadOrgs();
}
async function delOrg(row) {
  await deleteOrg(row._id);
  ElMessage.success('已停用');
  loadOrgs();
}

// 志愿者审批
async function doApprove(a, ok) {
  await import('../api/http.js').then(({default: http}) => http.post(`/api/volunteers/${a._id}/${ok?'approve':'reject'}`));
  ElMessage.success(ok ? '已通过' : '已拒绝');
  loadApps();
}

onMounted(() => { loadUsers(); loadOrgs(); loadApps(); });
</script>

<style scoped>
.s12 { font-size:12px; } .muted { color:#909399; }
.app-row { display:flex; align-items:center; gap:8px; padding:10px 0; border-bottom:1px dashed #eee; }
</style>
