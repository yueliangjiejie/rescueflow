/**
 * 定时任务调度器 —— 周期性刷新 SLA 超时标记。
 *
 * 启动后每 5 分钟扫描一次未完成求助,将超时项 slaBreached 置 true。
 * (超时提醒通知接入在 V2;V1 先标记,后台列表红色高亮。)
 */
import { refreshBreached } from './slaService.js';
import { refreshOverdue } from './matchService.js';
import { Help } from '../models/Help.js';

const SLA_SCAN_INTERVAL_MS = 5 * 60 * 1000;

let timer = null;

export function startScheduler() {
  if (timer) return;
  const tick = async () => {
    try {
      const n = await refreshBreached(Help);
      if (n > 0) console.log(`[sla] 标记 ${n} 条超时求助`);
      const m = await refreshOverdue();
      if (m > 0) console.log(`[match] 标记 ${m} 条对接超时未响应`);
    } catch (e) {
      console.warn('[scheduler] 扫描失败:', e.message);
    }
  };
  tick();
  timer = setInterval(tick, SLA_SCAN_INTERVAL_MS);
  console.log('[scheduler] SLA 扫描已启动(每 5 分钟)');
}

export function stopScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
