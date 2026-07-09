<template>
  <div class="app-wrap">
    <van-nav-bar title="应急求助登记" left-arrow @click-left="$router.back()" />

    <!-- 合规提示(始终明示)-->
    <div class="notice">
      本平台为民间信息协同工具,<span class="danger">不替代 110 / 119 / 120</span>,不承诺救援。
      信息需人工核实,仅收集最小必要信息并全程留痕。
    </div>

    <!-- 灾种选择(多灾种表单,Ushahidi 借鉴)-->
    <van-cell-group v-if="forms.length" inset title="选择灾种(决定后续填写项)">
      <van-cell>
        <div class="tag-row">
          <van-tag
            v-for="f in forms"
            :key="f.slug"
            :type="form.formId === f.slug ? 'danger' : 'plain'"
            size="large"
            round
            class="tag"
            @click="selectForm(f.slug)"
          >
            {{ f.name }}
          </van-tag>
          <van-tag
            :type="!form.formId ? 'primary' : 'plain'"
            size="large"
            round
            class="tag"
            @click="selectForm('')"
          >
            通用求助
          </van-tag>
        </div>
      </van-cell>
    </van-cell-group>

    <!-- 动态表单字段(按所选灾种的"信息录入"阶段渲染)-->
    <van-cell-group v-if="activeFormFields.length" inset :title="activeFormName + ' · 补充信息'">
      <template v-for="attr in activeFormFields" :key="attr.key">
        <van-field
          v-if="attr.type === 'select'"
          :label="attr.label"
          :required="attr.required"
          is-link
          readonly
          :model-value="form.formData[attr.key] || ''"
          :placeholder="`请选择${attr.label}`"
          @click="openPicker(attr)"
        />
        <van-field
          v-else-if="attr.type === 'number'"
          v-model="form.formData[attr.key]"
          :label="attr.label"
          :required="attr.required"
          type="digit"
          :placeholder="`请输入${attr.label}`"
        />
        <van-field
          v-else-if="attr.type === 'date'"
          :label="attr.label"
          :required="attr.required"
          is-link
          readonly
          :model-value="form.formData[attr.key] || ''"
          :placeholder="`选择${attr.label}`"
          @click="openDatePicker(attr)"
        />
        <van-field
          v-else
          v-model="form.formData[attr.key]"
          :label="attr.label"
          :required="attr.required"
          :placeholder="`请输入${attr.label}`"
        />
      </template>
    </van-cell-group>

    <!-- 登记方式 -->
    <van-cell-group inset title="登记方式">
      <van-grid :column-num="2" :gutter="8">
        <van-grid-item icon="edit" text="手动填写" @click="method = 'manual'" :class="{ active: method === 'manual' }" />
        <van-grid-item icon="service-o" text="语音登记" @click="method = 'voice'" :class="{ active: method === 'voice' }" />
      </van-grid>
    </van-cell-group>

    <!-- 语音登记 -->
    <van-cell-group v-if="method === 'voice'" inset title="语音登记(推荐)">
      <van-cell>
        <van-button
          :type="recording ? 'danger' : 'primary'"
          block
          :icon="recording ? 'stop' : 'audio'"
          @click="toggleRecord"
        >
          {{ recording ? '停止录音' : '按住说话 / 点击录音' }}
        </van-button>
      </van-cell>
      <van-cell v-if="voiceUrl" title="已录音">
        <template #value>
          <audio :src="voiceUrl" controls style="max-width: 100%"></audio>
        </template>
      </van-cell>
      <van-cell v-if="transcript" :label="'AI 转写(可编辑)'">
        <van-field v-model="form.rawText" type="textarea" rows="2" placeholder="转写文本" />
      </van-cell>
    </van-cell-group>

    <!-- 文字描述(手动或语音转写)-->
    <van-cell-group inset title="求助描述">
      <van-field
        v-model="form.rawText"
        type="textarea"
        rows="3"
        placeholder="请说明发生了什么、需要什么帮助、现场情况"
        autosize
      />
    </van-cell-group>

    <!-- 图片上传 -->
    <van-cell-group inset title="现场图片(可选)">
      <van-cell>
        <van-uploader v-model="fileList" :after-read="onUpload" multiple :max-count="6" />
      </van-cell>
    </van-cell-group>

    <!-- 位置 -->
    <van-cell-group inset title="位置信息">
      <van-cell title="自动定位" is-link @click="locate" :is-loading="locating">
        <template #value>
          <van-tag v-if="form.location.raw && form.location.lng" type="success" size="medium">✓ 已定位</van-tag>
          <span v-else-if="form.location.raw" class="muted">{{ form.location.raw }}</span>
          <span v-else-if="locating" class="muted">定位中...</span>
          <span v-else class="muted">点击获取定位</span>
        </template>
      </van-cell>
      <van-field v-model="form.location.raw" label="详细地址" placeholder="定位成功会自动填入,也可手填精确到门牌/村组" />
      <p v-if="form.location.lng" class="muted coords-hint">
        坐标: {{ form.location.lat?.toFixed(5) }}, {{ form.location.lng?.toFixed(5) }}(精度±{{ Math.round(form.location.accuracy||0) }}米)
      </p>
    </van-cell-group>

    <!-- 求助人信息 -->
    <van-cell-group inset title="联系方式(必填)">
      <van-field v-model="form.person.name" label="姓名" placeholder="可选(最小必要)" />
      <van-field v-model="form.person.phone" label="手机号" type="tel" placeholder="必填,核实用" required />
      <van-field label="登记对象">
        <template #input>
          <van-radio-group v-model="form.reporterRelation" direction="horizontal">
            <van-radio name="self">本人</van-radio>
            <van-radio name="other">代他人</van-radio>
          </van-radio-group>
        </template>
      </van-field>
      <van-field v-model.number="form.person.headcount" label="受困人数" type="digit" />
    </van-cell-group>

    <!-- 特殊人员标记(影响排序)-->
    <van-cell-group inset title="特殊人员(可多选,优先处理)">
      <van-checkbox-group v-model="form.person.specialPersons">
        <van-cell>
          <div class="tag-row">
            <van-tag
              v-for="opt in specialOpts"
              :key="opt.value"
              :type="form.person.specialPersons.includes(opt.value) ? 'danger' : 'plain'"
              size="large"
              round
              class="tag"
              @click="toggleSpecial(opt.value)"
            >
              {{ opt.label }}
            </van-tag>
          </div>
        </van-cell>
      </van-checkbox-group>
    </van-cell-group>

    <!-- 动态字段:select 弹层 -->
    <van-popup v-model:show="pickerShow" position="bottom" round>
      <van-picker
        :columns="pickerColumns"
        @confirm="onPickerConfirm"
        @cancel="pickerShow = false"
      />
    </van-popup>

    <!-- 动态字段:date 弹层 -->
    <van-popup v-model:show="datePickerShow" position="bottom" round>
      <van-date-picker
        v-model="dateVal"
        title="选择日期"
        @confirm="onDateConfirm"
        @cancel="datePickerShow = false"
      />
    </van-popup>

    <!-- 同意条款 -->
    <van-cell-group inset>
      <van-cell>
        <van-checkbox v-model="form.consent" shape="square">
          我已阅读并同意上述说明,知悉本平台不替代官方紧急渠道
        </van-checkbox>
      </van-cell>
    </van-cell-group>

    <div style="padding: 16px;">
      <van-button type="danger" block size="large" :loading="submitting" @click="submit">
        {{ submitting ? '提交中...' : '提交求助' }}
      </van-button>
      <p v-if="outbox.hasPending" class="muted" style="text-align:center; margin-top:8px; font-size:12px;">
        有 {{ outbox.pendingCount }} 条求助因网络问题暂存,联网后自动提交
      </p>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { showSuccessToast, showFailToast, showToast } from 'vant';
import { submitHelp, uploadFile, listForms, getForm } from '../api/help.js';
import { useOutboxStore } from '../stores/outbox.js';
import { SpecialPerson, SPECIAL_PERSON_LABELS, RegistrationMethod } from '@rescueflow/shared';

const router = useRouter();
const outbox = useOutboxStore();

// 灾种表单
const forms = ref([]); // 后端表单列表
const activeFormDef = ref(null); // 当前选中的完整表单定义(含字段)

const method = ref(RegistrationMethod.MANUAL);
const recording = ref(false);
const voiceUrl = ref('');
const voiceBlob = ref(null);
const transcript = ref('');
const fileList = ref([]);
const uploadedRefs = ref([]);
const submitting = ref(false);

const form = reactive({
  rawText: '',
  method: 'manual',
  reporterRelation: 'self',
  person: { name: '', phone: '', specialPersons: [], headcount: 1, contactPreference: 'public' },
  location: { lng: null, lat: null, raw: '' },
  attachments: [],
  consent: false,
  formId: '', // 选中的灾种 slug
  formData: {}, // 动态字段值
});

// 当前表单"信息录入"阶段(对外可见)的字段
const activeFormFields = computed(() => {
  if (!activeFormDef.value) return [];
  const stages = activeFormDef.value.stages || [];
  // 取所有非 internal-only 的阶段字段(核实阶段对群众隐藏)
  return stages
    .filter((s) => !s.isInternalOnly)
    .flatMap((s) => (s.attributes || []).map((a) => ({ ...a })))
    .sort((a, b) => (a.priority || 0) - (b.priority || 0));
});
const activeFormName = computed(() => activeFormDef.value?.name || '');

// 灾种选择
async function selectForm(slug) {
  form.formId = slug;
  if (!slug) {
    activeFormDef.value = null;
    form.formData = {};
    return;
  }
  const res = await getForm(slug);
  activeFormDef.value = res.data;
  // 切换灾种时清空旧字段值,避免字段错位
  form.formData = {};
}

// 动态字段:select picker
const pickerShow = ref(false);
const pickerColumns = ref([]);
const pickerActiveKey = ref('');
function openPicker(attr) {
  pickerActiveKey.value = attr.key;
  pickerColumns.value = attr.options || [];
  pickerShow.value = true;
}
function onPickerConfirm({ selectedValues }) {
  form.formData[pickerActiveKey.value] = selectedValues[0];
  pickerShow.value = false;
}

// 动态字段:date picker
const datePickerShow = ref(false);
const dateVal = ref([]);
const dateActiveKey = ref('');
function openDatePicker(attr) {
  dateActiveKey.value = attr.key;
  const cur = form.formData[attr.key];
  dateVal.value = cur ? cur.split('-') : [];
  datePickerShow.value = true;
}
function onDateConfirm({ selectedValues }) {
  form.formData[dateActiveKey.value] = selectedValues.join('-');
  datePickerShow.value = false;
}

const specialOpts = Object.entries(SPECIAL_PERSON_LABELS).map(([value, label]) => ({ value, label }));

function toggleSpecial(v) {
  const arr = form.person.specialPersons;
  const i = arr.indexOf(v);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(v);
}

// ---- 录音(MediaRecorder 浏览器 API;微信内可用 wx.startRecord)----
 let mediaRecorder = null;
 let chunks = [];
async function toggleRecord() {
  if (recording.value) {
    mediaRecorder?.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      voiceBlob.value = new Blob(chunks, { type: 'audio/webm' });
      voiceUrl.value = URL.createObjectURL(voiceBlob.value);
      recording.value = false;
      stream.getTracks().forEach((t) => t.stop());
      // 上传,服务端可接入 ASR;此处前端先占位
      uploadVoice();
    };
    mediaRecorder.start();
    recording.value = true;
  } catch (e) {
    showFailToast('无法访问麦克风:' + e.message);
  }
}

async function uploadVoice() {
  if (!voiceBlob.value) return;
  const file = new File([voiceBlob.value], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
  try {
    const res = await uploadFile(file);
    form.attachments.push(res.data.code);
    showToast('录音已上传');
  } catch (e) {
    // 降级:保留本地,提交时仍带 rawText
    showToast('录音上传失败,可继续填写文字');
  }
}

async function onUpload(read) {
  // vant after-read: 单文件或多文件;统一处理
  const items = Array.isArray(read) ? read : [read];
  for (const item of items) {
    const file = item.file;
    try {
      item.status = 'uploading';
      const res = await uploadFile(file);
      form.attachments.push(res.data.code);
      uploadedRefs.value.push(res.data.code);
      item.status = 'done';
    } catch (e) {
      item.status = 'failed';
      showToast('图片上传失败');
    }
  }
}

// ---- 定位 ----
const locating = ref(false);
async function locate() {
  if (!navigator.geolocation) return showFailToast('设备不支持定位');
  if (!navigator.permissions?.query) {
    // 非 https / 非 localhost 环境下 geolocation 直接不可用
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      return showFailToast('定位需在 https 或 localhost 环境下使用,请手填地址');
    }
  }
  locating.value = true;
  showToast('正在定位...');
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      form.location.lng = pos.coords.longitude;
      form.location.lat = pos.coords.latitude;
      form.location.accuracy = pos.coords.accuracy;
      // 尝试逆地理编码(经纬度→中文地址),失败则回退显示坐标
      const addr = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      form.location.raw = addr || `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
      locating.value = false;
      showSuccessToast('定位成功' + (addr ? '' : '(地址需手填)'));
    },
    (e) => {
      locating.value = false;
      const tip = ({
        1: '您拒绝了定位权限,请在浏览器设置中允许,或手填地址',
        2: '定位不可用(设备/网络问题),请手填地址',
        3: '定位超时,请重试或手填地址',
      }[e.code]) || ('定位失败:' + e.message);
      showFailToast(tip);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

// 逆地理编码:用高德免费 REST API(无需 key 的降级方案失败时回退坐标)
// 注意:生产环境应配置正式 key;此处为方便预览,失败不阻塞
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://restapi.amap.com/v3/geocode/regeo?location=${lng},${lat}&key=amap_demo&extensions=base`);
    const j = await res.json();
    if (j.status === '1' && j.regeocode?.formatted_address) return j.regeocode.formatted_address;
  } catch {}
  return '';
}

// ---- 提交(含断网补传)----
async function submit() {
  if (!form.consent) return showFailToast('请先勾选同意条款');
  if (!form.person.phone) return showFailToast('请填写联系方式');
  if (!form.rawText.trim() && form.attachments.length === 0) {
    return showFailToast('请填写描述或上传图片/语音');
  }
  // 动态表单必填校验(只校验对外可见阶段)
  if (activeFormFields.value.length) {
    const missing = activeFormFields.value.filter(
      (a) => a.required && !form.formData[a.key]
    );
    if (missing.length) {
      return showFailToast(`请填写:${missing.map((m) => m.label).join('、')}`);
    }
  }
  form.method = method.value;

  submitting.value = true;
  // 修复:后端期望 location.coordinates:[lng,lat],H5 表单存的是 lng/lat 分量
  const locPayload = form.location.lng != null && form.location.lat != null
    ? { coordinates: [form.location.lng, form.location.lat], address: form.location.raw, raw: form.location.raw, accuracy: form.location.accuracy }
    : { coordinates: [], address: form.location.raw || '', raw: form.location.raw || '' };
  const payload = {
    ...form,
    location: locPayload,
    // 仅在选中灾种时带 formId,避免发空串
    formId: form.formId || undefined,
    formData: form.formId ? form.formData : undefined,
    submittedAt: new Date().toISOString(),
    source: 'h5',
  };
  try {
    const res = await submitHelp(payload);
    // 记住我发布的求助编号,供"我发布的求助"页读取
    try {
      const myHelps = JSON.parse(localStorage.getItem('rf_my_helps') || '[]');
      myHelps.unshift({ code: res.data.code, at: Date.now(), summary: form.rawText.slice(0, 40) });
      localStorage.setItem('rf_my_helps', JSON.stringify(myHelps.slice(0, 50)));
    } catch {}
    showSuccessToast('提交成功');
    router.replace({ name: 'success', params: { code: res.data.code } });
  } catch (e) {
    if (e.__networkError) {
      // 断网:入队,联网自动补传
      outbox.enqueue(payload);
      showToast({ message: '当前网络不可用,已暂存,联网后自动提交', duration: 2500 });
      router.replace({ name: 'success', params: { code: 'pending' } });
    } else {
      showFailToast(e.message || '提交失败');
    }
  } finally {
    submitting.value = false;
  }
}

// ---- 在线时自动补传 ----
const flush = async () => {
  if (!navigator.onLine) return;
  await outbox.flush(async (payload) => {
    await submitHelp(payload);
  });
};
const onOnline = () => flush();
onMounted(async () => {
  window.addEventListener('online', onOnline);
  flush();
  // 加载多灾种表单列表(失败不阻塞登记,降级为通用求助)
  try {
    const res = await listForms();
    forms.value = res.data || [];
  } catch {
    forms.value = [];
  }
});
onUnmounted(() => window.removeEventListener('online', onOnline));
</script>

<style scoped>
.active :deep(.van-grid-item__text) { color: var(--rf-danger); font-weight: 600; }
.tag-row { display: flex; flex-wrap: wrap; gap: 8px; }
.tag { padding: 6px 12px; }
.muted { color: #969799; }
.coords-hint { font-size: 11px; color: #969799; margin: 6px 14px 8px; }
</style>
