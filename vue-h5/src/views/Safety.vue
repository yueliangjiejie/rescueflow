<template>
  <div class="app-wrap">
    <van-nav-bar title="报平安 / 寻亲" left-arrow @click-left="$router.back()" />

    <van-tabs v-model="active">
      <!-- 报平安 -->
      <van-tab title="我要报平安" name="report">
        <div class="notice">告知家人和救援:您现在是否安全。报平安的信息可被家属按姓名/电话查询。</div>
        <van-cell-group inset>
          <van-field v-model="form.name" label="姓名" placeholder="必填" required />
          <van-field v-model="form.phone" label="电话" placeholder="便于家人确认" />
          <van-cell title="当前状态">
            <template #label>
              <van-radio-group v-model="form.status" direction="horizontal">
                <van-radio name="safe">已安全</van-radio>
                <van-radio name="sheltered">在安置点</van-radio>
                <van-radio name="need_help">仍需帮助</van-radio>
              </van-radio-group>
            </template>
          </van-cell>
          <van-field v-model="form.currentLocation" label="现在哪里" placeholder="如:XX安置点 / 亲戚家" />
          <van-field v-model="form.message" type="textarea" rows="2" label="给家人的话" placeholder="如:我和孩子都好,勿念" />
        </van-cell-group>
        <div style="padding:16px;">
          <van-button type="success" block size="large" :loading="loading" @click="submit">提交报平安</van-button>
        </div>
      </van-tab>

      <!-- 寻亲 -->
      <van-tab title="寻亲查询" name="search">
        <div class="notice">输入姓名或电话,查询是否已有人报平安。</div>
        <van-cell-group inset>
          <van-field v-model="q.name" label="姓名" placeholder="输入姓名" @keyup.enter="search" />
          <van-field v-model="q.phone" label="电话" placeholder="完整电话" @keyup.enter="search" />
        </van-cell-group>
        <div style="padding:16px;">
          <van-button type="primary" block :loading="searching" @click="search">查询</van-button>
        </div>

        <van-cell-group v-if="results.length" inset title="查询结果">
          <van-cell v-for="r in results" :key="r._id">
            <template #title>
              <div><b>{{ r.name }}</b>
                <van-tag :type="statusType(r.status)" size="medium" style="margin-left:6px;">{{ statusLabel(r.status) }}</van-tag>
              </div>
              <div class="muted" style="font-size:12px; margin-top:4px;">
                {{ r.currentLocation || '未填写位置' }} · {{ fmt(r.createdAt) }}
              </div>
              <div v-if="r.message" style="margin-top:4px;">"{{ r.message }}"</div>
            </template>
          </van-cell>
        </van-cell-group>
        <van-empty v-else-if="searched" description="暂未找到匹配的报平安记录" />
      </van-tab>
    </van-tabs>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { showSuccessToast, showFailToast } from 'vant';
import { reportSafe, searchSafety } from '../api/help.js';

const active = ref('report');
const loading = ref(false);
const form = reactive({ name:'', phone:'', status:'safe', currentLocation:'', message:'' });

async function submit() {
  if (!form.name) return showFailToast('请填写姓名');
  loading.value = true;
  try {
    await reportSafe({ ...form });
    showSuccessToast('已报平安');
    form.message = '';
  } catch(e) { showFailToast(e.message||'提交失败'); }
  finally { loading.value = false; }
}

// 寻亲
const q = reactive({ name:'', phone:'' });
const results = ref([]);
const searched = ref(false);
const searching = ref(false);
async function search() {
  if (!q.name && !q.phone) return showFailToast('请输入姓名或电话');
  searching.value = true;
  try {
    const res = await searchSafety({ name: q.name, phone: q.phone });
    results.value = res.data || [];
    searched.value = true;
  } catch(e) { showFailToast(e.message||'查询失败'); }
  finally { searching.value = false; }
}

const statusLabel = (s) => ({ safe:'已安全', sheltered:'在安置点', need_help:'仍需帮助' }[s]||s);
const statusType = (s) => ({ safe:'success', sheltered:'primary', need_help:'danger' }[s]||'default');
const fmt = (t) => t ? new Date(t).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
</script>
