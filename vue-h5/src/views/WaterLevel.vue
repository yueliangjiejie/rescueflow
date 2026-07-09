<template>
  <div class="app-wrap">
    <van-nav-bar title="上报水位" left-arrow @click-left="$router.back()" />
    <div class="notice">您上报的水位会帮助救援和指挥部判断水情,也会提醒下游做好转移准备。</div>

    <van-cell-group inset title="您的位置">
      <van-field v-model="form.location" label="地点" placeholder="如:XX村3组 / XX路口" required />
      <van-cell title="自动定位" is-link @click="locate">
        <template #value><span class="muted">{{ form.lng ? `${form.lat},${form.lng}` : '点击获取' }}</span></template>
      </van-cell>
    </van-cell-group>

    <van-cell-group inset title="当前水位(选最接近的)">
      <van-radio-group v-model="form.level">
        <van-cell v-for="opt in levels" :key="opt.value" clickable @click="form.level = opt.value">
          <template #title>
            <van-radio :name="opt.value">{{ opt.label }}</van-radio>
          </template>
          <template v-if="form.level===opt.value" #right-icon><van-icon name="success" color="#ee0a24" /></template>
        </van-cell>
      </van-radio-group>
    </van-cell-group>

    <van-cell-group inset title="趋势与说明">
      <van-cell title="水位趋势">
        <template #label>
          <van-radio-group v-model="form.trend" direction="horizontal">
            <van-radio name="rising">还在涨</van-radio>
            <van-radio name="stable">持平</van-radio>
            <van-radio name="falling">在退</van-radio>
          </van-radio-group>
        </template>
      </van-cell>
      <van-field v-model="form.description" type="textarea" rows="2" placeholder="补充说明,如:一楼进水/主干道断行" />
    </van-cell-group>

    <div style="padding:16px;">
      <van-button type="danger" block size="large" :loading="loading" @click="submit">提交水位</van-button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showSuccessToast, showFailToast } from 'vant';
import { reportWaterLevel } from '../api/help.js';

const router = useRouter();
const loading = ref(false);
const levels = [
  { value:0, label:'无积水' }, { value:1, label:'及踝' }, { value:2, label:'齐膝' },
  { value:3, label:'齐腰' }, { value:4, label:'齐胸' }, { value:5, label:'齐脖以上' }, { value:6, label:'已淹一层' },
];
const form = reactive({ location:'', lng:null, lat:null, level:2, trend:'rising', description:'' });

async function locate() {
  if (!navigator.geolocation) return showFailToast('设备不支持定位');
  navigator.geolocation.getCurrentPosition((p) => {
    form.lng = p.coords.longitude; form.lat = p.coords.latitude;
  }, () => showFailToast('定位失败,请手填地点'), { timeout:8000 });
}

async function submit() {
  if (!form.location) return showFailToast('请填写地点');
  loading.value = true;
  try {
    await reportWaterLevel({
      location: form.location,
      coordinates: form.lng ? [form.lng, form.lat] : [],
      level: form.level, trend: form.trend, description: form.description,
    });
    showSuccessToast('水位已上报,感谢');
    router.back();
  } catch(e) { showFailToast(e.message||'提交失败'); }
  finally { loading.value = false; }
}
</script>
