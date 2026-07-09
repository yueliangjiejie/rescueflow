<template>
  <div class="app-wrap login-page">
    <div class="login-hero">
      <van-icon name="shield-o" size="48" color="#fff" />
      <h1>管理员登录</h1>
      <p>RescueFlow 应急协同平台</p>
    </div>

    <div class="login-form">
      <van-cell-group inset>
        <van-field
          v-model="form.username"
          label="账号"
          placeholder="请输入账号"
          left-icon="manager-o"
          clearable
        />
        <van-field
          v-model="form.password"
          label="密码"
          placeholder="请输入密码"
          left-icon="lock"
          type="password"
          clearable
          @keyup.enter="doLogin"
        />
      </van-cell-group>

      <div style="padding: 16px;">
        <van-button type="primary" block size="large" :loading="loading" @click="doLogin">
          登 录
        </van-button>
        <p class="muted hint">
          测试账号：admin / admin123<br />
          登录后可进行求助核实、志愿者审批、供需对接
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showSuccessToast, showFailToast } from 'vant';
import { login } from '../api/admin.js';

const router = useRouter();
const loading = ref(false);
const form = reactive({ username: '', password: '' });

async function doLogin() {
  if (!form.username || !form.password) return showFailToast('请输入账号和密码');
  loading.value = true;
  try {
    const res = await login({ username: form.username, password: form.password });
    const { token, user } = res.data;
    // 持久化登录态(与 vue-admin 一致,http.js 拦截器读取这些 key)
    localStorage.setItem('rf_token', token);
    localStorage.setItem('rf_user', JSON.stringify(user));
    localStorage.setItem('rf_actor_id', user.username);
    localStorage.setItem('rf_actor_role', user.role);
    showSuccessToast('登录成功');
    router.replace('/admin');
  } catch (e) {
    showFailToast(e.message || '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-hero {
  background: linear-gradient(135deg, #1989fa 0%, #0d6efd 100%);
  padding: 48px 16px 40px;
  text-align: center;
  color: #fff;
}
.login-hero h1 { margin: 12px 0 4px; font-size: 22px; }
.login-hero p { margin: 0; font-size: 13px; opacity: 0.85; }
.login-form { margin-top: -16px; position: relative; }
.hint { text-align: center; font-size: 11px; line-height: 1.8; margin-top: 12px; }
.muted { color: #969799; }
</style>
