/**
 * SLA 服务 —— 根据紧急度计算截止时间,标记是否超时。
 *
 * 阈值见 shared/constants.js SLA_MINUTES:
 *   critical 30min / high 2h / medium 8h / low 24h
 *
 * 用于列表排序与超时提醒,避免求助石沉大海。
 */
import { SLA_MINUTES } from '@rescueflow/shared';

/**
 * 计算某求助的 SLA 截止时间。
 * @param {string} urgency
 * @param {Date} from 提交时间,默认 now
 * @returns {Date|null}
 */
export function computeSlaDeadline(urgency, from = new Date()) {
  const minutes = SLA_MINUTES[(urgency || '').toUpperCase()] ?? null;
  if (!minutes) return null;
  return new Date(from.getTime() + minutes * 60 * 1000);
}

/**
 * 判断是否已超时。
 */
export function isBreached(deadline, now = new Date()) {
  if (!deadline) return false;
  return now.getTime() > deadline.getTime();
}

/**
 * 扫描所有未完成求助,更新 slaBreached 标记。
 * 由定时任务/后台轮询调用(阶段3接入)。
 */
export async function refreshBreached(HelpModel) {
  const res = await HelpModel.updateMany(
    {
      status: { $in: ['pending', 'verified', 'transferred', 'in_progress'] },
      slaDeadline: { $ne: null, $lt: new Date() },
      slaBreached: { $ne: true },
    },
    { $set: { slaBreached: true } }
  ).exec();
  return res.modifiedCount;
}
