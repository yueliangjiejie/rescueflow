<template>
  <div>
    <el-alert type="warning" :closable="false" style="margin-bottom:10px;">
      粘贴一段混杂信息(微信群聊天/新闻/多条求助)或一个网页链接,AI 自动拆解成结构化条目。核对后勾选入库。
      <b>这能极大减轻现场逐条录入的负担。</b>
    </el-alert>

    <!-- 输入区 -->
    <el-card shadow="never" style="margin-bottom:10px;">
      <el-tabs v-model="mode">
        <el-tab-pane label="粘贴文本" name="text">
          <el-input
            v-model="input.text" type="textarea" :rows="8"
            placeholder="把聊天记录/新闻/求助信息整段粘贴这里。例如:&#10;张三 13812345678 在XX村水到二楼,有老人小孩急需转移&#10;李四 13900001111 柳州大道决堤,车辆不通&#10;王芳说她在安置点平安"
          />
        </el-tab-pane>
        <el-tab-pane label="粘贴链接" name="url">
          <el-input v-model="input.url" placeholder="https://... 新闻或网页链接,自动抓取内容" clearable />
          <div class="muted" style="font-size:12px; margin-top:6px;">部分网站可能禁止抓取,失败时请改用粘贴文本。</div>
        </el-tab-pane>
      </el-tabs>

      <div style="margin-top:10px; display:flex; gap:8px; align-items:center;">
        <el-button type="primary" :loading="parsing" @click="doParse">
          <el-icon><MagicStick /></el-icon>&nbsp;AI 拆解预览
        </el-button>
        <el-checkbox v-if="result" v-model="selectAll" @change="toggleAll">全选</el-checkbox>
        <span v-if="result" class="muted" style="font-size:12px;">共 {{ result.items.length }} 条</span>
      </div>
    </el-card>

    <!-- 拆解结果(预览 + 可编辑) -->
    <el-card v-if="result" shadow="never" style="margin-bottom:10px;">
      <template #header>
        <span>拆解结果</span>
        <el-tag v-if="result.degraded" type="warning" size="small" style="margin-left:6px;">规则提取(AI未配置)</el-tag>
        <el-tag v-else type="success" size="small" style="margin-left:6px;">AI 拆解</el-tag>
      </template>

      <div v-for="(it, i) in result.items" :key="it._tempId" class="item-row" :class="it.kind">
        <el-checkbox v-model="it._checked" />
        <div class="item-content">
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-bottom:4px;">
            <el-tag :type="kindTagType(it.kind)" size="small" effect="dark">{{ kindLabel(it.kind) }}</el-tag>
            <el-input v-model="it.name" placeholder="姓名" size="small" style="width:90px;" />
            <el-input v-model="it.phone" placeholder="电话" size="small" style="width:130px;" />
            <el-input v-model="it.location" placeholder="地点" size="small" style="width:150px;" />
            <el-select v-if="it.kind==='need'" v-model="it.urgency" size="small" style="width:90px;">
              <el-option label="紧急" value="critical" /><el-option label="紧迫" value="high" /><el-option label="一般" value="medium" /><el-option label="报备" value="low" />
            </el-select>
            <el-select v-else-if="it.kind==='offer'" v-model="it.type" size="small" style="width:100px;">
              <el-option label="物资" value="supplies" /><el-option label="运力" value="transport" /><el-option label="服务" value="service" /><el-option label="场地" value="venue" />
            </el-select>
          </div>
          <el-input v-model="it.summary" placeholder="摘要" size="small" />
          <div style="margin-top:4px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
            <el-tag v-for="s in (it.specialPersons||[])" :key="s" size="small" type="warning" closable @close="it.specialPersons.splice(it.specialPersons.indexOf(s),1)">{{ specialLabel(s) }}</el-tag>
            <span v-if="it.kind==='need'" class="muted" style="font-size:11px;">人数 {{ it.headcount }}</span>
            <span v-if="it.kind==='offer' && it.quantity" class="muted" style="font-size:11px;">数量 {{it.quantity}}{{it.unit}}</span>
          </div>
        </div>
      </div>

      <el-empty v-if="!result.items.length" description="未提取到有效条目" />
    </el-card>

    <!-- 入库按钮 -->
    <el-card v-if="result && result.items.length" shadow="never">
      <el-button type="success" size="large" :loading="importing" @click="doImport">
        <el-icon><Check /></el-icon>&nbsp;勾选入库({{ checkedCount }} 条)
      </el-button>
      <span class="muted" style="margin-left:10px; font-size:12px;">
        将按性质分流:求助→求助列表 · 援助→互助墙 · 报平安→寻亲 · 水位→水情
      </span>
      <div style="margin-top:6px;" v-if="kindBreakdown">
        <el-tag v-for="k in kindBreakdown" :key="k.kind" :type="kindTagType(k.kind)" size="small" style="margin-right:6px;">
          {{ kindLabel(k.kind) }} {{ k.count }}
        </el-tag>
      </div>
    </el-card>

    <!-- 入库结果 -->
    <el-card v-if="importResult" shadow="never" style="margin-top:10px;">
      <template #header><span>入库结果</span></template>
      <el-alert :type="importResult.failed?.length ? 'warning' : 'success'" :closable="false">
        求助 {{ importResult.summary?.need||0 }} · 援助 {{ importResult.summary?.offer||0 }} · 报平安 {{ importResult.summary?.safety||0 }} · 水位 {{ importResult.summary?.water||0 }}
        <span v-if="importResult.summary?.failed"> · 失败 {{ importResult.summary.failed }}</span>
      </el-alert>
      <div v-if="importResult.created?.need?.length" style="margin-top:8px;">
        <span class="muted s12">求助:</span>
        <el-tag v-for="c in importResult.created.need" :key="c" size="small" type="danger" style="margin:2px;">{{ c }}</el-tag>
      </div>
      <div v-if="importResult.created?.offer?.length" style="margin-top:6px;">
        <span class="muted s12">互助:</span>
        <el-tag v-for="c in importResult.created.offer" :key="c" size="small" type="success" style="margin:2px;">{{ c }}</el-tag>
      </div>
      <div v-if="importResult.failed?.length" style="margin-top:6px;">
        <div v-for="(f, i) in importResult.failed" :key="i" class="muted" style="font-size:12px;">{{ f.summary }} → {{ f.error }}</div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { parseIntake, importIntake } from '../api/admin.js';

const mode = ref('text');
const input = reactive({ text: '', url: '' });
const parsing = ref(false);
const importing = ref(false);
const result = ref(null);
const importResult = ref(null);
const selectAll = ref(false);

const specialLabel = (s) => ({elderly:'老人',child:'儿童',pregnant:'孕妇',disabled:'残疾',patient:'急病',isolated:'失联'}[s]||s);
const checkedCount = computed(() => result.value?.items.filter(i => i._checked).length || 0);

const kindLabel = (k) => ({need:'求助',offer:'援助',safety:'报平安',water:'水位',ignore:'忽略'}[k]||k);
const kindTagType = (k) => ({need:'danger',offer:'success',safety:'primary',water:'warning',ignore:'info'}[k]||'info');
const kindBreakdown = computed(() => {
  if (!result.value) return null;
  const checked = result.value.items.filter(i => i._checked);
  const m = {};
  checked.forEach(i => { m[i.kind] = (m[i.kind]||0)+1; });
  return Object.entries(m).map(([kind,count]) => ({kind,count}));
});

function toggleAll(v) {
  result.value.items.forEach(it => { it._checked = v; });
}

async function doParse() {
  parsing.value = true;
  importResult.value = null;
  try {
    const body = mode.value === 'url' ? { url: input.url } : { text: input.text };
    if (!body.url && !body.text) return ElMessage.warning('请输入内容');
    const res = await parseIntake(body);
    result.value = { ...res.data, items: res.data.items.map(it => ({ ...it, _checked: true })) };
    selectAll.value = true;
    ElMessage.success(res.message);
  } catch (e) {
    ElMessage.error(e.message || '解析失败');
  } finally { parsing.value = false; }
}

async function doImport() {
  const items = result.value.items.filter(i => i._checked);
  if (!items.length) return ElMessage.warning('请至少勾选一条');
  importing.value = true;
  try {
    const res = await importIntake({ items });
    importResult.value = res.data;
    ElMessage.success(res.message);
    result.value = null;
  } catch (e) {
    ElMessage.error(e.message || '入库失败');
  } finally { importing.value = false; }
}
</script>

<style scoped>
.item-row {
  display:flex; gap:8px; padding:8px 0 8px 8px; border-bottom:1px dashed #eee; align-items:flex-start;
  border-left:3px solid transparent;
}
.item-row.need { border-left-color:#f56c6c; }
.item-row.offer { border-left-color:#67c23a; }
.item-row.safety { border-left-color:#409eff; }
.item-row.water { border-left-color:#e6a23c; }
.item-content { flex:1; display:flex; flex-direction:column; gap:4px; }
.s12 { font-size:12px; }
</style>
