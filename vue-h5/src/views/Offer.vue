<template>
  <div class="app-wrap">
    <van-nav-bar title="我能帮什么" left-arrow @click-left="$router.back()" />
    <div class="notice">群策群力:无论是物资、运力、服务还是场地,发布出来让需要的人能找到您。</div>

    <van-cell-group inset title="供给类型">
      <van-grid :column-num="4" :gutter="6">
        <van-grid-item v-for="t in types" :key="t.value" :icon="t.icon" :text="t.label"
          @click="form.type = t.value" :class="{active: form.type===t.value}" />
      </van-grid>
    </van-cell-group>

    <van-cell-group inset title="详细信息">
      <van-field v-model="form.title" label="标题" placeholder="如:可捐200箱矿泉水" required />
      <van-field v-model="form.category" label="类别" placeholder="如:饮用水/方便面/皮卡/船只/医生" />
      <van-cell v-if="form.type==='supplies'" title="数量">
        <template #label>
          <div style="display:flex; gap:8px;">
            <input v-model.number="form.quantity" type="number" placeholder="数量" class="num-input" />
            <input v-model="form.unit" placeholder="单位(箱/瓶/件)" class="num-input" />
          </div>
        </template>
      </van-cell>
      <van-field v-model="form.description" type="textarea" rows="2" label="补充说明" placeholder="物资情况、新旧程度、服务时段等" />
    </van-cell-group>

    <van-cell-group inset title="联系与位置">
      <van-field v-model="form.providerName" label="称呼" placeholder="个人或组织名" />
      <van-field v-model="form.providerPhone" label="电话" type="tel" placeholder="便于对接" />
      <van-field v-model="form.location" label="位置" placeholder="如:XX市XX路 / 可送至XX" />
      <van-cell title="能否配送/到场">
        <template #label>
          <van-switch v-model="form.canDeliver" />
          <span style="margin-left:8px; font-size:13px;">{{ form.canDeliver ? '能配送/到场' : '需自取' }}</span>
        </template>
      </van-cell>
    </van-cell-group>

    <div style="padding:16px;">
      <van-button type="success" block size="large" :loading="loading" @click="submit">
        发布到互助墙
      </van-button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showSuccessToast, showFailToast } from 'vant';
import { createOffer } from '../api/help.js';

const router = useRouter();
const loading = ref(false);
const types = [
  { value:'supplies', label:'物资', icon:'gift-o' },
  { value:'transport', label:'运力', icon:'logistics' },
  { value:'service', label:'服务', icon:'service-o' },
  { value:'venue', label:'场地', icon:'shop-o' },
];
const form = reactive({ type:'supplies', title:'', category:'', quantity:null, unit:'', description:'', providerName:'', providerPhone:'', location:'', canDeliver:false });

async function submit() {
  if (!form.title) return showFailToast('请填写标题');
  loading.value = true;
  try {
    await createOffer({ ...form });
    showSuccessToast('已发布,可在互助墙查看');
    router.push('/feed');
  } catch(e) { showFailToast(e.message||'发布失败'); }
  finally { loading.value = false; }
}
</script>

<style scoped>
.active :deep(.van-grid-item__text) { color:#07c160; font-weight:600; }
.num-input { border:1px solid #dcdee0; border-radius:4px; padding:4px 8px; font-size:14px; width:80px; }
</style>
