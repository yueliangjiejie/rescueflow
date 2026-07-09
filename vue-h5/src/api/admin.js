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
// 删除/恢复求助(软删除)
export function deleteHelp(code) {
  return http.post(`/api/admin/helps/${code}/delete`, {});
}
export function restoreHelp(code) {
  return http.post(`/api/admin/helps/${code}/restore`, {});
}
// 组织/承接方列表(转交目标)
export function listOrgs() {
  return http.get('/api/organizations');
}

// ===== 信息墙 - 供给管理 =====
export function listAdminOffers(params) {
  return http.get('/api/admin/offers', { params });
}
export function updateOffer(code, body) {
  return http.put(`/api/admin/offers/${code}`, body);
}
export function deleteOffer(code) {
  return http.post(`/api/admin/offers/${code}/delete`, {});
}
export function restoreOffer(code) {
  return http.post(`/api/admin/offers/${code}/restore`, {});
}

// ===== 志愿者审批 =====
export function listVolunteerApps(params) {
  return http.get('/api/volunteers/applications', { params });
}
export function approveVolunteer(id, body = {}) {
  return http.post(`/api/volunteers/${id}/approve`, body);
}
export function rejectVolunteer(id, body = {}) {
  return http.post(`/api/volunteers/${id}/reject`, body);
}

// ===== 供需对接 =====
export function getMatchDashboard() {
  return http.get('/api/dashboard/match');
}
export function listMatches(params) {
  return http.get('/api/matches', { params });
}
export function matchOffers(helpCode) {
  return http.get('/api/offers/match', { params: { help: helpCode } });
}

// ===== 调度引擎 =====
export function getVolunteerPool(params) {
  return http.get('/api/volunteers/pool', { params });
}
export function updateVolunteerStatus(uid, status) {
  return http.put(`/api/volunteers/${uid}/status`, { status });
}
export function getRecommendations(helpCode) {
  return http.get('/api/dispatch/recommend', { params: { helpCode } });
}
export function dispatchAssign(helpCode, volunteerUid, note) {
  return http.post('/api/dispatch/assign', { helpCode, volunteerUid, note });
}

// ===== 群体应急闭环管理 =====
// 名单系统
export function listRosterEvents(params) {
  return http.get('/api/rosters/events', { params });
}
export function getRosterEvent(id) {
  return http.get(`/api/rosters/events/${id}`);
}
export function createRosterEvent(body) {
  return http.post('/api/rosters/events', body);
}
export function updateRosterEvent(id, body) {
  return http.put(`/api/rosters/events/${id}`, body);
}
export function setRosterEventStatus(id, status) {
  return http.put(`/api/rosters/events/${id}/status`, { status });
}
export function deleteRosterEvent(id) {
  return http.delete(`/api/rosters/events/${id}`);
}
export function listRosterPersons(eventId, params) {
  return http.get(`/api/rosters/events/${eventId}/persons`, { params });
}
export function importRosterPersons(eventId, persons) {
  return http.post(`/api/rosters/events/${eventId}/persons`, persons);
}
export function updatePersonStatus(personId, body) {
  return http.put(`/api/rosters/persons/${personId}`, body);
}
export function getRosterStats(eventId) {
  return http.get(`/api/rosters/events/${eventId}/stats`);
}
// 物资台账
export function listDistStandards(eventId) {
  return http.get('/api/distributions/standards', { params: { eventId } });
}
export function createDistStandard(body) {
  return http.post('/api/distributions/standards', body);
}
export function listDistributions(eventId) {
  return http.get('/api/distributions', { params: { eventId } });
}
export function createDistribution(body) {
  return http.post('/api/distributions', body);
}
export function getDistributionGaps(eventId) {
  return http.get(`/api/distributions/${eventId}/gaps`);
}
// 责任区
export function listZones(eventId) {
  return http.get('/api/zones', { params: { eventId } });
}
export function createZone(body) {
  return http.post('/api/zones', body);
}
export function checkZone(zoneId, body) {
  return http.put(`/api/zones/${zoneId}/check`, body);
}
export function assignZoneLeader(zoneId, body) {
  return http.put(`/api/zones/${zoneId}/assign`, body);
}
// 事件记录
export function listEventLogs(eventId) {
  return http.get('/api/event-logs', { params: { eventId } });
}
export function createEventLog(body) {
  return http.post('/api/event-logs', body);
}
export function createMatch(body) {
  return http.post('/api/matches', body);
}
export const acceptMatch = (code) => http.post(`/api/matches/${code}/accept`, {});
export const markTransit = (code) => http.post(`/api/matches/${code}/transit`, {});
export const markDelivered = (code) => http.post(`/api/matches/${code}/deliver`, {});
export const completeMatch = (code) => http.post(`/api/matches/${code}/complete`, {});
export const cancelMatch = (code) => http.post(`/api/matches/${code}/cancel`, {});
