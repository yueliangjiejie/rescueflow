/**
 * RescueFlow 全局常量
 * 设计来源:V0.1 设计汇总 第7节(编号体系)、第6节(可信度)、第10节(合规)
 */

// 编号前缀 —— 一件事一个编号,一次处理全程留痕
export const ID_PREFIX = Object.freeze({
  EVENT: 'INC', // 事件(聚合容器,如一次洪涝)
  HELP: 'HELP', // 求助(核心实体)
  TASK: 'TASK', // 任务(V2)
  MATERIAL: 'MAT', // 物资(V2)
  VOLUNTEER: 'VOL', // 志愿者(V2)
  SHELTER: 'SHE', // 安置点(V2)
  ROAD: 'ROAD', // 道路(V2),
});

// 默认省份代号(用于编号 {省} 位);运行时可按事件实际区域覆盖
export const DEFAULT_REGION = 'GX';

// 编号年份基线
export const ID_YEAR = 2026;

// 分页默认值
export const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
});

// SLA 超时阈值(分钟)——超时自动提醒,避免求助石沉大海
export const SLA_MINUTES = Object.freeze({
  CRITICAL: 30, // 红色:30 分钟
  HIGH: 120, // 橙色:2 小时
  MEDIUM: 480, // 黄色:8 小时
  LOW: 1440, // 蓝色:24 小时(无硬性 SLA)
});

// 五级可信度(第6节)——AI 仅辅助,不替代人工审核
export const CREDIBILITY = Object.freeze({
  OFFICIAL: { level: 5, label: '官方确认', stars: '★★★★★' },
  VOLUNTEER: { level: 4, label: '志愿者确认', stars: '★★★★' },
  MULTI_SOURCE: { level: 3, label: '多来源一致', stars: '★★★' },
  PENDING: { level: 2, label: '待核实', stars: '★★' },
  RISK: { level: 1, label: '风险信息', stars: '★' },
});

// 合规声明文案(第10节)——登记入口与详情均需明示
export const COMPLIANCE_NOTICE =
  '本平台为民间信息协同工具,不替代 110 / 119 / 120 等官方紧急渠道,不承诺救援。' +
  '信息需人工核实,仅收集最小必要信息并全程留痕。';

// 数据保留期默认值(天),与 .env DATA_RETENTION_DAYS 联动
export const DEFAULT_DATA_RETENTION_DAYS = 365;
