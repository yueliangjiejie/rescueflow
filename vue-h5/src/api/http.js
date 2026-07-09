import axios from 'axios';

// 群众端不要求鉴权;管理员登录后由拦截器自动注入 token + actor 头
const http = axios.create({
  baseURL: '/',
  timeout: 20000,
});

// 请求拦截器:登录态自动注入身份头(与 vue-admin 一致)
http.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('rf_token');
  if (token) {
    cfg.headers['Authorization'] = `Bearer ${token}`;
  }
  cfg.headers['x-actor-id'] = localStorage.getItem('rf_actor_id') || 'public';
  cfg.headers['x-actor-role'] = localStorage.getItem('rf_actor_role') || 'public';
  return cfg;
});

// 失败不直接抛错,而是返回 { __networkError: true },由调用方决定是否入断网队列
http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response) {
      // 业务错误:后端返回的 JSON
      return Promise.reject({ __handled: true, code: err.response.status, message: err.response.data?.message || '请求失败' });
    }
    // 网络错误(断网/超时):交给 store-and-forward 处理
    return Promise.reject({ __networkError: true, message: err.message });
  }
);

export default http;
