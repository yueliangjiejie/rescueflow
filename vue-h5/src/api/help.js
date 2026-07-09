import http from './http.js';

/**
 * 登记求助。失败(断网)时由调用方 decide 是否入队。
 */
export function submitHelp(payload) {
  return http.post('/api/helps', payload);
}

/**
 * 上传附件(语音/图片)。
 */
export function uploadFile(file, { duration } = {}) {
  const form = new FormData();
  form.append('file', file);
  if (duration) form.append('duration', String(duration));
  return http.post('/api/helps/upload', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 });
}

/**
 * 获取多灾种表单列表(用于登记页灾种选择)。
 */
export function listForms() {
  return http.get('/api/forms');
}

/**
 * 获取单个表单详情(含字段定义,用于动态渲染)。
 */
export function getForm(slug) {
  return http.get(`/api/forms/${slug}`);
}

// ===== 洪涝场景 =====
export function reportWaterLevel(body) {
  return http.post('/api/water-levels', body);
}
export function reportSafe(body) {
  return http.post('/api/safety', body);
}
export function searchSafety(params) {
  return http.get('/api/safety/search', { params });
}
export function reportRoad(body) {
  return http.post('/api/roads', body);
}

// ===== 互助 / 公开信息墙 =====
export function getFeed(params) {
  return http.get('/api/feed', { params });
}
export function createOffer(body) {
  return http.post('/api/offers', body);
}
export function createMatch(body) {
  return http.post('/api/matches', body);
}
export function getMatches(helpCode) {
  return http.get('/api/matches', { params: { helpCode } });
}
export function advanceMatch(code, action, body) {
  return http.post(`/api/matches/${code}/${action}`, body);
}

