/**
 * 编号生成服务 —— 把 MongoDB Counter 包装成 shared 的 nextSeq 接口。
 *
 * 服务层用法:
 *   import { genId } from './idService.js';
 *   const helpId = await genId(ID_PREFIX.HELP, { region: 'GX' });
 */
import { createIdGenerator, ID_PREFIX } from '@rescueflow/shared';
import { Counter } from '../models/Counter.js';

const counterStore = {
  nextSeq(prefix, region, year) {
    return Counter.nextSeq(prefix, region, year);
  },
};

export const genId = createIdGenerator(counterStore);
export { ID_PREFIX };
