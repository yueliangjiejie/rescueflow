import http from './http.js';

export const listHelps = (params) => http.get('/api/admin/helps', { params });
export const getHelp = (code) => http.get(`/api/admin/helps/${code}`);
export const getAudit = (code) => http.get(`/api/admin/helps/${code}/audit`);
export const transition = (code, body) => http.post(`/api/admin/helps/${code}/transition`, body);
export const verify = (code, body) => http.post(`/api/admin/helps/${code}/verify`, body);
export const transfer = (code, body) => http.post(`/api/admin/helps/${code}/transfer`, body);
export const markAbnormal = (code, body) => http.post(`/api/admin/helps/${code}/abnormal`, body);
export const reveal = (code) => http.get(`/api/admin/helps/${code}/reveal`);
export const exportUrl = (params) => '/api/admin/export?' + new URLSearchParams(params).toString();

// 认领 / 脱险(DRAP + 救命文档借鉴)
export const claim = (code) => http.post(`/api/helps/${code}/claim`, {});
export const unclaim = (code) => http.post(`/api/helps/${code}/unclaim`, {});
export const setResolved = (code, body) => http.post(`/api/helps/${code}/resolve`, body);
export const matchVolunteers = (params) => http.get('/api/volunteers/match', { params });
export const listSkills = () => http.get('/api/skills');
export const listForms = () => http.get('/api/forms');

// 避难所 / 灾民 / 物资(移植自 DRAP)
export const listShelters = (params) => http.get('/api/shelters', { params });
export const createShelter = (body) => http.post('/api/shelters', body);
export const checkInInmate = (shelterId, body) => http.post(`/api/shelters/${shelterId}/inmates`, body);
export const searchInmates = (params) => http.get('/api/inmates/search', { params });
export const addResourceFlow = (body) => http.post('/api/resource-flows', body);
export const getInventory = (params) => http.get('/api/inventory', { params });
export const listResourceTypes = () => http.get('/api/resource-types');

// 洪涝态势(水位/报平安/道路/看板)
export const getWaterMap = (params) => http.get('/api/dashboard/water-map', { params });
export const getRegions = (params) => http.get('/api/dashboard/regions', { params });
export const getOverview = () => http.get('/api/dashboard/overview');
export const searchSafety = (params) => http.get('/api/safety/search', { params });
export const listRoads = (params) => http.get('/api/roads', { params });

// 智能录入(AI 辅助批量整理)
export const parseIntake = (body) => http.post('/api/intake/parse', body);
export const importIntake = (body) => http.post('/api/intake/import', body);

// 供需匹配 / 对接流转
export const getMatchDashboard = () => http.get('/api/dashboard/match');
export const listMatches = (params) => http.get('/api/matches', { params });
export const acceptMatch = (code, body) => http.post(`/api/matches/${code}/accept`, body);
export const markTransit = (code, body) => http.post(`/api/matches/${code}/transit`, body);
export const markDelivered = (code, body) => http.post(`/api/matches/${code}/deliver`, body);
export const completeMatch = (code, body) => http.post(`/api/matches/${code}/complete`, body);
export const cancelMatch = (code, body) => http.post(`/api/matches/${code}/cancel`, body);

// 推荐供给 / 创建认领
export const matchOffers = (helpCode) => http.get('/api/offers/match', { params: { help: helpCode } });
export const createMatch = (body) => http.post('/api/matches', body);
export const listMyMatches = (params) => http.get('/api/matches', { params });

// 用户/组织/志愿者管理
export const listUsers = (params) => http.get('/api/users', { params });
export const createUser = (body) => http.post('/api/users', body);
export const updateUser = (id, body) => http.put(`/api/users/${id}`, body);
export const deleteUser = (id) => http.delete(`/api/users/${id}`);
export const listOrgs = (params) => http.get('/api/organizations', { params });
export const createOrg = (body) => http.post('/api/organizations', body);
export const updateOrg = (id, body) => http.put(`/api/organizations/${id}`, body);
export const deleteOrg = (id) => http.delete(`/api/organizations/${id}`);
export const listVolunteerApps = (params) => http.get('/api/volunteers/applications', { params });

// Help 管理:指派核实人/删除/恢复
export const assignVerifier = (code, body) => http.post(`/api/admin/helps/${code}/assign-verifier`, body);
export const deleteHelp = (code) => http.post(`/api/admin/helps/${code}/delete`, {});
export const restoreHelp = (code) => http.post(`/api/admin/helps/${code}/restore`, {});
