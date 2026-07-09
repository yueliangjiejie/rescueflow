/**
 * 健康检查 & 系统状态路由。
 *   GET /api/health        存活
 *   GET /api/health/status 各依赖配置就绪情况(供运维快速排查)
 */
import { Router } from 'express';
import { ok } from '../utils/response.js';
import { env } from '../config/env.js';
import { isAiReady } from '../services/aiService.js';

export const router = Router();

router.get('/health', (_req, res) => {
  res.json(ok({ status: 'up', time: new Date().toISOString() }));
});

router.get('/health/status', (_req, res) => {
  // 不泄露密钥,仅报告是否就绪
  res.json(
    ok({
      mongo: !!env.mongoUri ? 'configured' : 'missing',
      wechat: env.wxAppId ? 'configured' : 'missing',
      map: env.tencentMapKey ? 'configured' : 'missing',
      ai: isAiReady() ? 'configured' : 'missing',
      nodeEnv: env.nodeEnv,
    })
  );
});
