<template>
  <div class="app-wrap">
    <van-nav-bar title="智能录入" left-arrow @click-left="$router.back()" />
    <div class="notice">
      粘贴群聊/语音转写文本，AI 自动拆解为多条记录并分类（求助/援助/报平安/水位），核对后一键入库。
    </div>

    <!-- 粘贴输入 -->
    <van-cell-group inset title="录入内容">
      <van-field
        v-model="rawText"
        type="textarea"
        rows="6"
        placeholder="粘贴群聊截图文字 / 语音转写结果 / 多条信息&#10;&#10;例：&#10;XX村3组张建国13812345678，水已到2楼，有老人小孩急需转移&#10;李总13500001001可捐200箱矿泉水，南宁江南区仓库"
        autosize
        show-word-limit
        maxlength="5000"
      />
    </van-cell-group>

    <!-- 落实时间 -->
    <van-cell-group inset title="落实时间（可选）">
      <van-field
        v-model="estimatedTime"
        label="发生时间"
        placeholder="如：2026-07-09 14:00，方便知道是什么时候的需求"
        is-link
        readonly
        @click="showDatePicker = true"
      />
    </van-cell-group>

    <div style="padding: 16px;">
      <van-button type="primary" block size="large" :loading="parsing" icon="service-o" @click="parse">
        AI 拆解
      </van-button>
      <p class="muted" style="text-align:center; font-size:11px; margin-top:6px;">
        支持多电话多段落自动切分，按性质分流入库
      </p>
    </div>

    <!-- 拆解结果 -->
    <div v-if="result" class="parse-result">
      <div class="result-header">
        <span>AI 拆解出 <b>{{ result.items.length }}</b> 条记录</span>
        <van-tag :type="result.degraded ? 'warning' : 'success'" size="medium">
          {{ result.degraded ? '规则模式' : 'AI模式' }}
        </van-tag>
      </div>

      <!-- 核对列表 -->
      <div v-for="(it, idx) in result.items" :key="it._tempId" class="result-item" :class="it.kind">
        <div class="item-head">
          <van-tag :type="kindType(it.kind)" size="medium">{{ kindLabel(it.kind) }}</van-tag>
          <van-tag v-if="it.urgency==='critical'" type="danger" size="mini">紧急</van-tag>
          <van-tag v-if="it.urgency==='high'" type="warning" size="mini">较急</van-tag>
          <span class="muted" style="margin-left:auto; font-size:11px;">置信度 {{ Math.round(it.confidence*100) }}%</span>
        </div>
        <div class="item-summary">{{ it.summary }}</div>
        <div class="item-fields">
          <div v-if="it.name" class="item-field"><span class="label">联系人</span>{{ it.name }}</div>
          <div v-if="it.phone" class="item-field"><span class="label">电话</span>{{ it.phone }}</div>
          <div v-if="it.location" class="item-field"><span class="label">位置</span>{{ it.location }}</div>
          <div v-if="it.quantity" class="item-field"><span class="label">数量</span>{{ it.quantity }} {{ it.unit }}</div>
          <div v-if="it.headcount" class="item-field"><span class="label">人数</span>{{ it.headcount }}</div>
          <div v-if="it.specialPersons?.length" class="item-field">
            <span class="label">特殊人员</span>{{ it.specialPersons.map(s => SP_LABELS[s]||s).join(', ') }}
          </div>
        </div>
        <!-- 可修改 -->
        <div class="item-edit">
          <van-field v-model="it.name" label="姓名" size="mini" placeholder="联系人" />
          <van-field v-model="it.phone" label="电话" size="mini" placeholder="联系电话" />
          <van-field v-model="it.location" label="位置" size="mini" placeholder="所在位置" />
          <van-field v-model="it.summary" label="摘要" type="textarea" rows="1" autosize size="mini" placeholder="摘要" />
        </div>
      </div>

      <div style="padding: 16px;">
        <van-button type="success" block size="large" :loading="importing" icon="success" @click="doImport">
          核对无误，一键入库（{{ result.items.length }} 条）
        </van-button>
      </div>
    </div>

    <!-- 日期选择器 -->
    <van-popup v-model:show="showDatePicker" position="bottom" round>
      <van-date-picker
        v-model="dateVal"
        title="选择发生时间"
        :min-date="minDate"
        @confirm="onDateConfirm"
        @cancel="showDatePicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { showSuccessToast, showFailToast, showToast } from 'vant';
import http from '../api/http.js';

const router = useRouter();
const rawText = ref('');
const parsing = ref(false);
const importing = ref(false);
const result = ref(null);
const estimatedTime = ref('');
const showDatePicker = ref(false);
const dateVal = ref([]);
const minDate = new Date(2024, 0, 1);

const SP_LABELS = { elderly: '老人', child: '儿童/小孩', pregnant: '孕妇', disabled: '残疾人', infant: '婴儿' };
const kindLabel = (k) => ({ need:'求助', offer:'援助', safety:'报平安', water:'水位' }[k] || k);
const kindType = (k) => ({ need:'danger', offer:'success', safety:'primary', water:'warning' }[k] || 'default');

function onDateConfirm({ selectedValues }) {
  estimatedTime.value = selectedValues.join('-');
  showDatePicker.value = false;
}

async function parse() {
  if (!rawText.value.trim()) return showFailToast('请粘贴内容');
  parsing.value = true;
  try {
    const res = await http.post('/api/intake/parse', { text: rawText.value });
    result.value = res.data;
    if (res.data.items.length === 0) showToast('未识别出有效信息');
  } catch (e) {
    showFailToast(e.message || 'AI 拆解失败');
  } finally {
    parsing.value = false;
  }
}

async function doImport() {
  if (!result.value?.items.length) return;
  importing.value = true;
  try {
    const payload = result.value.items.map(it => ({
      ...it,
      estimatedTime: estimatedTime.value || undefined,
    }));
    const res = await http.post('/api/intake/import', { items: payload });
    const s = res.data.summary;
    showSuccessToast(`入库成功：求助${s.need} 援助${s.offer} 报平安${s.safety} 水位${s.water}`);
    rawText.value = '';
    result.value = null;
    estimatedTime.value = '';
  } catch (e) {
    showFailToast(e.message || '入库失败');
  } finally {
    importing.value = false;
  }
}
</script>

<style scoped>
.parse-result { padding: 0 0 20px; }
.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f7f8fa;
  font-size: 14px;
  font-weight: 600;
}
.result-item { margin: 8px 12px; border-radius: 8px; overflow: hidden; border: 1px solid #ebedf0; }
.result-item.need { border-left: 3px solid #ee0a24; }
.result-item.offer { border-left: 3px solid #07c160; }
.result-item.safety { border-left: 3px solid #1989fa; }
.result-item.water { border-left: 3px solid #ff976a; }
.item-head { display:flex; align-items:center; gap:4px; padding:8px 10px; background:#fafafa; }
.item-summary { padding: 8px 10px; font-size: 13px; line-height: 1.5; color: #323233; }
.item-fields { padding: 0 10px 6px; font-size: 12px; }
.item-field { display:flex; gap:6px; margin-top:2px; color:#646566; }
.item-field .label { color:#969799; white-space:nowrap; }
.item-edit { padding: 6px 10px; background:#fafafa; border-top:1px dashed #eee; }
.muted { color:#969799; }
</style>
