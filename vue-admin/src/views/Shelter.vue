<template>
  <div>
    <el-tabs v-model="active">
      <!-- 避难所 -->
      <el-tab-pane label="避难所" name="shelters">
        <el-card shadow="never" style="margin-bottom:12px;">
          <el-button type="primary" @click="shelterDlg = true">新建避难所</el-button>
          <el-button @click="loadShelters">刷新</el-button>
        </el-card>
        <el-card shadow="never">
          <el-table :data="shelters" v-loading="loading.sh" @row-click="(r)=>selectShelter(r)">
            <el-table-column prop="code" label="编号" width="180" />
            <el-table-column prop="name" label="名称" min-width="160" />
            <el-table-column prop="location" label="位置" min-width="140" />
            <el-table-column label="容量" width="130">
              <template #default="{ row }">
                <span :class="{danger: row.inmates >= row.totalCapacity}">{{ row.inmates }} / {{ row.totalCapacity }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="row.available ? 'success' : 'danger'" size="small">{{ row.available ? '可接收' : '已满' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="contactDetails" label="联系电话" width="130" />
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 灾民/寻亲 -->
      <el-tab-pane label="灾民登记 / 寻亲" name="inmates">
        <el-card shadow="never" style="margin-bottom:12px;">
          <el-form inline>
            <el-form-item label="姓名">
              <el-input v-model="search.name" clearable placeholder="搜索姓名" style="width:140px;" @keyup.enter="loadInmates" />
            </el-form-item>
            <el-form-item label="电话">
              <el-input v-model="search.contact" clearable placeholder="完整电话" style="width:160px;" @keyup.enter="loadInmates" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="loadInmates">寻亲查询</el-button>
            </el-form-item>
          </el-form>
        </el-card>
        <el-card shadow="never">
          <el-table :data="inmates" v-loading="loading.in">
            <el-table-column prop="name" label="姓名" width="100" />
            <el-table-column prop="place" label="原住址" min-width="140" />
            <el-table-column prop="age" label="年龄" width="70" />
            <el-table-column prop="contact" label="电话" width="130" />
            <el-table-column label="特殊" width="100">
              <template #default="{ row }">
                <el-tag v-for="s in (row.specialPersons||[])" :key="s" type="warning" size="small" style="margin-right:2px;">{{ specialLabels[s]||s }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="入住时间" width="150">
              <template #default="{ row }">{{ fmt(row.checkedInAt) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status==='in'?'success':'info'" size="small">{{ row.status==='in'?'在住':'已离' }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!inmates.length" description="输入姓名或电话查询灾民登记情况" />
        </el-card>
      </el-tab-pane>

      <!-- 物资 -->
      <el-tab-pane label="物资管理" name="resource">
        <el-card shadow="never" style="margin-bottom:12px;">
          <el-form inline>
            <el-form-item label="避难所">
              <el-select v-model="inventory.shelterId" clearable placeholder="全部" style="width:220px;" @change="loadInventory">
                <el-option v-for="s in shelters" :key="s._id" :label="s.name" :value="s._id" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button @click="loadInventory">刷新库存</el-button>
              <el-button type="success" @click="flowDlg = true">登记物资流水</el-button>
            </el-form-item>
          </el-form>
        </el-card>
        <el-card shadow="never" header="当前库存(净:入库-消耗)">
          <el-table :data="inventory.list" v-loading="loading.inv">
            <el-table-column prop="name" label="物资" min-width="140" />
            <el-table-column label="数量" width="120">
              <template #default="{ row }">
                <span :class="{danger: row.low}">{{ row.quantity }} {{ row.unit }}</span>
                <el-tag v-if="row.low" type="danger" size="small" style="margin-left:4px;">短缺</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!inventory.list.length" description="暂无库存数据,登记物资流水后自动汇总" />
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 新建避难所弹窗 -->
    <el-dialog v-model="shelterDlg" title="新建避难所" width="460px">
      <el-form label-width="80px">
        <el-form-item label="名称"><el-input v-model="shelterForm.name" placeholder="如:第一中学体育馆" /></el-form-item>
        <el-form-item label="位置"><el-input v-model="shelterForm.location" /></el-form-item>
        <el-form-item label="容量"><el-input-number v-model="shelterForm.totalCapacity" :min="1" /></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="shelterForm.contactDetails" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shelterDlg=false">取消</el-button>
        <el-button type="primary" @click="doCreateShelter">创建</el-button>
      </template>
    </el-dialog>

    <!-- 物资流水弹窗 -->
    <el-dialog v-model="flowDlg" title="登记物资流水" width="540px">
      <el-form label-width="80px">
        <el-form-item label="避难所">
          <el-select v-model="flowForm.shelterId" style="width:100%">
            <el-option v-for="s in shelters" :key="s._id" :label="s.name" :value="s._id" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="flowForm.type">
            <el-radio-button value="allocate">调拨入库</el-radio-button>
            <el-radio-button value="donate">捐赠入库</el-radio-button>
            <el-radio-button value="consume">消耗出库</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="物资">
          <div v-for="(r,i) in flowForm.resources" :key="i" style="margin-bottom:8px;">
            <el-input v-model="r.resourceType" placeholder="物资名" style="width:140px;" />
            <el-input-number v-model="r.quantity" :min="0" placeholder="数量" style="width:120px;margin:0 8px;" />
            <el-input v-model="r.unit" placeholder="单位" style="width:80px;" />
            <el-button link type="danger" @click="flowForm.resources.splice(i,1)">删除</el-button>
          </div>
          <el-button size="small" @click="flowForm.resources.push({resourceType:'',quantity:0,unit:''})">+ 添加物资</el-button>
        </el-form-item>
        <el-form-item label="来源/备注"><el-input v-model="flowForm.fromParty" placeholder="如:民政物资库 / 热心市民" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="flowDlg=false">取消</el-button>
        <el-button type="primary" @click="doAddFlow">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';
import { listShelters, createShelter, searchInmates, addResourceFlow, getInventory } from '../api/admin.js';
import { SPECIAL_PERSON_LABELS } from '@rescueflow/shared';

const active = ref('shelters');
const specialLabels = SPECIAL_PERSON_LABELS;
const loading = reactive({ sh: false, in: false, inv: false });

const shelters = ref([]);
const inmates = ref([]);
const inventory = reactive({ shelterId: '', list: [] });
const search = reactive({ name: '', contact: '' });

async function loadShelters() {
  loading.sh = true;
  try { const res = await listShelters(); shelters.value = res.data || []; } finally { loading.sh = false; }
}
async function loadInmates() {
  loading.in = true;
  try {
    const params = {};
    if (search.name) params.name = search.name;
    if (search.contact) params.contact = search.contact;
    const res = await searchInmates(params);
    inmates.value = res.data || [];
  } finally { loading.in = false; }
}
async function loadInventory() {
  loading.inv = true;
  try {
    const params = {};
    if (inventory.shelterId) params.shelterId = inventory.shelterId;
    const res = await getInventory(params);
    inventory.list = res.data || [];
  } finally { loading.inv = false; }
}

// 新建避难所
const shelterDlg = ref(false);
const shelterForm = reactive({ name:'', location:'', totalCapacity:100, contactDetails:'' });
async function doCreateShelter() {
  if (!shelterForm.name) return ElMessage.warning('请填写名称');
  await createShelter({ ...shelterForm });
  ElMessage.success('已创建');
  shelterDlg.value = false;
  loadShelters();
}

// 物资流水
const flowDlg = ref(false);
const flowForm = reactive({ shelterId:'', type:'allocate', resources:[{resourceType:'',quantity:0,unit:''}], fromParty:'' });
async function doAddFlow() {
  if (!flowForm.shelterId) return ElMessage.warning('请选择避难所');
  const valid = flowForm.resources.filter(r => r.resourceType && r.quantity > 0);
  if (!valid.length) return ElMessage.warning('请添加有效物资');
  await addResourceFlow({ ...flowForm, resources: valid });
  ElMessage.success('已登记');
  flowDlg.value = false;
  flowForm.resources = [{resourceType:'',quantity:0,unit:''}];
  loadInventory();
}

const fmt = (t) => t ? dayjs(t).format('MM-DD HH:mm') : '';
const selectShelter = (r) => { inventory.shelterId = r._id; active.value = 'resource'; loadInventory(); };

onMounted(loadShelters);
</script>
