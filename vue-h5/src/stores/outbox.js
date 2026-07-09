/**
 * 断网补传(store-and-forward)。
 *
 * 灾区信号差,登记【绝不能因没网而失败】:
 *  - 提交时若断网,把表单 payload(含附件引用)存进 localStorage 队列。
 *  - 监听 online 事件 + 页面可见时,自动重发队列。
 *  - 全程提示用户"已暂存,联网后自动提交"。
 */
import { defineStore } from 'pinia';

const KEY = 'rf_outbox';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}
function save(queue) {
  localStorage.setItem(KEY, JSON.stringify(queue));
}

export const useOutboxStore = defineStore('outbox', {
  state: () => ({ queue: load() }),
  getters: {
    pendingCount: (s) => s.queue.length,
    hasPending: (s) => s.queue.length > 0,
  },
  actions: {
    enqueue(payload) {
      this.queue.push({ payload, queuedAt: Date.now() });
      save(this.queue);
    },
    remove(index) {
      this.queue.splice(index, 1);
      save(this.queue);
    },
    /**
     * 尝试重发整个队列。成功一条删一条。
     * @param {function} sender async (payload) => any;成功 resolve、失败 reject
     */
    async flush(sender) {
      const ok = [];
      for (let i = 0; i < this.queue.length; ) {
        try {
          await sender(this.queue[i].payload);
          ok.push(this.queue[i]);
          this.queue.splice(i, 1);
        } catch (e) {
          // 遇到第一个失败就停(大概率还是断网),其余下次再试
          break;
        }
      }
      save(this.queue);
      return ok;
    },
  },
});
