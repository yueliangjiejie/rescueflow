import http from './http.js';

/**
 * H5 内嵌管理 API —— 复用同一套后端(/api/admin/*、/api/volunteers/*、/api/matches)。
 * 与 vue-admin/src/api/admin.js 同源,数据互通。
 */

// ===== 登录 =====
export function login(body) {
  return http.post('/api/auth/login', body);
}

// ===== 求助审批 =====
export function listHelps(params) {
  return http.get('/api/admin/helps', { params });
}
// 统一状态流转:verify / transfer / transition / abnormal / resolve
export function helpAction(code, action, body) {
  return http.post(`/api/admin/helps/${code}/${action}`, body);
}
// 查看明文联系方式(管理员核实用,后端留痕)
export function revealHelp(code) {
  return http.get(`/api/admin/helps/${code}/reveal`);
}

// ===== 志愿者审批 =====
export function listVolunteerApps(params) {
  return http.get('/api/volunteers/applications', { params });
}
export function approveVolunteer(id) {
  return http.post(`/api/volunteers/${id}/approve`, {});
}
export function rejectVolunteer(id) {
  return http.post(`/api/volunteers/${id}/reject`, {});
}

// ===== 供需对接 =====
export function getMatchDashboard() {
  return http.get('/api/dashboard/match');
}
export function listMatches(params) {
  return http.get('/api/matches', { params });
}
export const acceptMatch = (code) => http.post(`/api/matches/${code}/accept`, {});
export const markTransit = (code) => http.post(`/api/matches/${code}/transit`, {});
export const markDelivered = (code) => http.post(`/api/matches/${code}/deliver`, {});
export const completeMatch = (code) => http.post(`/api/matches/${code}/complete`, {});
export const cancelMatch = (code) => http.post(`/api/matches/${code}/cancel`, {});
