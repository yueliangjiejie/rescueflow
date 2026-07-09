import axios from 'axios';

const http = axios.create({ baseURL: '/', timeout: 30000 });

// 注入 actor 头(阶段3由登录态提供)
http.interceptors.request.use((cfg) => {
  cfg.headers['x-actor-id'] = localStorage.getItem('rf_actor_id') || 'operator-1';
  cfg.headers['x-actor-role'] = localStorage.getItem('rf_actor_role') || 'operator';
  return cfg;
});

http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    ElMessage?.error(err.response?.data?.message || err.message || '请求失败');
    return Promise.reject(err);
  }
);

export default http;
