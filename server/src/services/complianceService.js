/**
 * 合规服务 —— 集中管理合规文案与数据保留期。
 */
import { COMPLIANCE_NOTICE } from '@rescueflow/shared';
import { env } from '../config/env.js';

export { COMPLIANCE_NOTICE };

// 数据保留期(天),从 env 读取
export const DATA_RETENTION_DAYS_PROXY = env.dataRetentionDays;

/**
 * 完整合规清单(供前端/导出引用)。
 */
export const COMPLIANCE_POINTS = [
  '不替代 110 / 119 / 120 等官方紧急渠道',
  '不承诺救援',
  '不公开个人隐私(默认脱敏,授权访问留痕)',
  '最小必要信息收集',
  '信息需人工核实,AI 仅辅助',
  '全程操作留痕(哈希链,防篡改)',
  `数据保留期 ${env.dataRetentionDays} 天,到期可申请删除`,
];
