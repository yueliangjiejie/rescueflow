<template>
  <div class="app-wrap">
    <van-nav-bar title="群体事件上报" left-arrow @click-left="$router.back()" />

    <div class="notice">
      <van-icon name="warning-o" color="#ee0a24" />
      <span>发现<b>群体被困</b>（学校/小区/工厂等整建制被困）？请尽快上报,平台将启动群体应急协调。</span>
    </div>

    <div v-if="!submitted">
      <!-- 基本信息 -->
      <van-cell-group inset title="基本信息">
        <van-field v-model="form.name" label="事件名称" placeholder="如:XX中学师生被困" required />
        <van-field label="灾害类型" readonly>
          <template #input>
            <div class="tag-row">
              <span v-for="t in DISASTER_TYPES" :key="t.value"
                :class="['tag', { active: form.type === t.value }]"
                @click="form.type = t.value">{{ t.label }}</span>
            </div>
          </template>
        </van-field>
        <van-field label="紧急程度">
          <template #input>
            <van-radio-group v-model="form.urgency" direction="horizontal">
              <van-radio name="critical">紧急</van-radio>
              <van-radio name="high">紧迫</van-radio>
              <van-radio name="medium">一般</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <van-field
          v-model="form.scene"
          label="现场情况"
          type="textarea" rows="3"
          placeholder="描述当前状况,如:洪水已淹到2楼,师生困在教学楼3层以上,断水断电"
          required
        />
      </van-cell-group>

      <!-- 地点信息 -->
      <van-cell-group inset title="地点信息">
        <van-cell title="自动定位" is-link @click="locate" :is-loading="locating">
          <template #value>
            <van-tag v-if="form.coordinates.length===2" type="success" size="medium">✓ 已定位</van-tag>
            <span v-else-if="locating" class="muted">定位中...</span>
            <span v-else class="muted">点击获取定位</span>
          </template>
        </van-cell>
        <van-field v-model="form.address" label="地址" placeholder="省市区/街道" required />
        <van-field v-model="form.locationDetail" label="详细位置" placeholder="如:XX中学3号教学楼2-3层" />
      </van-cell-group>

      <!-- 群体信息 -->
      <van-cell-group inset title="群体信息">
        <van-field label="群体类型" readonly>
          <template #input>
            <div class="tag-row">
              <span v-for="g in GROUP_TYPES" :key="g.value"
                :class="['tag', { active: form.groupType === g.value }]"
                @click="form.groupType = g.value">{{ g.label }}</span>
            </div>
          </template>
        </van-field>
        <van-field v-model.number="form.estimatedCount" label="预估人数" type="digit" placeholder="约多少人被困" required />
        <van-field label="特殊群体" readonly>
          <template #input>
            <div class="tag-row">
              <span v-for="s in SPECIAL_GROUPS" :key="s"
                :class="['tag', { active: form.hasSpecialGroups.includes(s) }]"
                @click="toggleSpecial(s)">{{ s }}</span>
            </div>
          </template>
        </van-field>
      </van-cell-group>

      <!-- 紧急需求 -->
      <van-cell-group inset title="紧急需求（可多选）">
        <van-field label="急需" readonly>
          <template #input>
            <div class="tag-row">
              <span v-for="n in COMMON_NEEDS" :key="n"
                :class="['tag', { active: form.needs.includes(n) }]"
                @click="toggleNeed(n)">{{ n }}</span>
            </div>
          </template>
        </van-field>
        <van-field v-model="otherNeed" label="其他需求" placeholder="输入后点添加">
          <template #button>
            <van-button size="small" @click="addOtherNeed">添加</van-button>
          </template>
        </van-field>
      </van-cell-group>

      <!-- 上报人信息 -->
      <van-cell-group inset title="上报人信息">
        <van-field v-model="form.contactName" label="姓名" placeholder="您的称呼" required />
        <van-field v-model="form.contactPhone" label="电话" type="tel" placeholder="11位手机号" required />
        <van-field v-model="form.contactRole" label="身份" placeholder="如:园长/社区干部/志愿者" />
      </van-cell-group>

      <div style="padding: 16px;">
        <van-checkbox v-model="form.consent" shape="square" style="margin-bottom:12px;">
          我确认以上信息真实有效,同意平台用于应急协调
        </van-checkbox>
        <van-button type="danger" block size="large" :loading="submitting" @click="submit">
          立即上报群体事件
        </van-button>
      </div>
    </div>

    <!-- 提交成功 -->
    <div v-else class="success-page">
      <van-icon name="passed" size="64" color="#07c160" />
      <h2>上报成功</h2>
      <p class="muted">事件编号：<b>{{ result?.code }}</b></p>
      <p class="muted">平台已收到您的上报,将尽快启动群体应急协调。</p>
      <van-cell-group inset style="margin-top:16px;">
        <van-cell title="事件名称" :value="result?.name" />
        <van-cell title="预估人数" :value="`${result?.estimatedCount}人`" />
        <van-cell title="上报时间" :value="fmt(result?.createdAt)" />
      </van-cell-group>
      <div style="padding:16px; display:flex; gap:8px;">
        <van-button block plain @click="$router.push('/feed')">查看信息墙</van-button>
        <van-button block type="primary" @click="reset">再报一条</van-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { showToast, showSuccessToast, showFailToast } from 'vant';
import { createRosterEvent } from '../api/admin.js';

const DISASTER_TYPES = [
  { value:'flood', label:'洪水' }, { value:'earthquake', label:'地震' },
  { value:'fire', label:'火灾' }, { value:'landslide', label:'滑坡' },
  { value:'typhoon', label:'台风' }, { value:'other', label:'其他' },
];
const GROUP_TYPES = [
  { value:'school', label:'学校' }, { value:'community', label:'社区' },
  { value:'factory', label:'工厂' }, { value:'hospital', label:'医院' },
  { value:'village', label:'村庄' }, { value:'other', label:'其他' },
];
const SPECIAL_GROUPS = ['老人','儿童','孕妇','伤员','残疾人','失联者'];
const COMMON_NEEDS = ['紧急转移','食物','饮用水','药品','保暖衣物','充电照明','医疗救治','心理疏导'];

const submitting = ref(false);
const submitted = ref(false);
const result = ref(null);
const locating = ref(false);
const otherNeed = ref('');

const form = reactive({
  name: '', type: 'flood', urgency: 'high', scene: '',
  address: '', locationDetail: '', coordinates: [],
  groupType: 'school', estimatedCount: null, hasSpecialGroups: [],
  needs: [], contactName: '', contactPhone: '', contactRole: '',
  consent: false,
});

function toggleSpecial(s) {
  const i = form.hasSpecialGroups.indexOf(s);
  if (i >= 0) form.hasSpecialGroups.splice(i, 1); else form.hasSpecialGroups.push(s);
}
function toggleNeed(n) {
  const i = form.needs.indexOf(n);
  if (i >= 0) form.needs.splice(i, 1); else form.needs.push(n);
}
function addOtherNeed() {
  const n = otherNeed.value.trim();
  if (!n) return;
  if (!form.needs.includes(n)) form.needs.push(n);
  otherNeed.value = '';
}

// 定位(复用Register的逻辑)
async function locate() {
  if (!navigator.geolocation) return showFailToast('设备不支持定位');
  locating.value = true;
  showToast('正在定位...');
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      form.coordinates = [pos.coords.longitude, pos.coords.latitude];
      // 逆地理编码
      try {
        const res = await fetch(`https://restapi.amap.com/v3/geocode/regeo?location=${pos.coords.longitude},${pos.coords.latitude}&key=amap_demo&extensions=base`);
        const j = await res.json();
        if (j.status === '1' && j.regeocode?.formatted_address) form.address = j.regeocode.formatted_address;
      } catch {}
      locating.value = false;
      showSuccessToast('定位成功');
    },
    (e) => {
      locating.value = false;
      showFailToast({ 1:'您拒绝了定位,请手填地址', 2:'定位不可用,请手填', 3:'定位超时' }[e.code] || '定位失败');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

async function submit() {
  if (!form.name.trim()) return showFailToast('请填写事件名称');
  if (!form.scene.trim()) return showFailToast('请描述现场情况');
  if (!form.address.trim()) return showFailToast('请填写地址');
  if (!form.estimatedCount) return showFailToast('请预估被困人数');
  if (!form.contactName.trim()) return showFailToast('请填写上报人姓名');
  if (!/^1[3-9]\d{9}$/.test(form.contactPhone)) return showFailToast('请输入正确的手机号');
  if (!form.consent) return showFailToast('请勾选同意条款');

  submitting.value = true;
  try {
    const res = await createRosterEvent({
      name: form.name, type: form.type, urgency: form.urgency, scene: form.scene,
      address: form.address, locationDetail: form.locationDetail, coordinates: form.coordinates,
      groupType: form.groupType, estimatedCount: form.estimatedCount, hasSpecialGroups: form.hasSpecialGroups,
      needs: form.needs, contactName: form.contactName, contactPhone: form.contactPhone, contactRole: form.contactRole,
    });
    result.value = res.data;
    submitted.value = true;
    showSuccessToast('上报成功');
  } catch (e) { showFailToast(e.message || '上报失败'); }
  finally { submitting.value = false; }
}

function reset() {
  submitted.value = false;
  result.value = null;
  Object.assign(form, { name:'', type:'flood', urgency:'high', scene:'', address:'', locationDetail:'', coordinates:[], groupType:'school', estimatedCount:null, hasSpecialGroups:[], needs:[], contactName:'', contactPhone:'', contactRole:'', consent:false });
}

const fmt = (t) => t ? new Date(t).toLocaleString('zh-CN') : '';
</script>

<style scoped>
.notice { display:flex; gap:6px; padding:10px 12px; background:#fff1f0; font-size:12px; color:#8c2011; align-items:flex-start; }
.tag-row { display:flex; flex-wrap:wrap; gap:6px; }
.tag { padding:4px 10px; border:1px solid #dcdee0; border-radius:4px; font-size:13px; color:#646566; }
.tag.active { background:#ee0a24; border-color:#ee0a24; color:#fff; }
.success-page { text-align:center; padding:24px 16px; }
.success-page h2 { color:#07c160; }
.muted { color:#969799; font-size:13px; }
</style>
