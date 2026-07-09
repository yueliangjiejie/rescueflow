import axios from 'axios';

// 群众端不要求鉴权;管理后台用单独实例带 token(阶段2)
const http = axios.create({
  baseURL: '/',
  timeout: 20000,
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
