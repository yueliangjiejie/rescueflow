/**
 * RescueFlow 后端入口。
 *
 * 本地: node src/app.js  (npm -w server run dev)
 * 部署: 作为腾讯云 CloudBase 云函数包装;此 app.js 保持框架无关,便于迁移。
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { ensureDevAdmin } from './services/authService.js';
import { startScheduler } from './services/scheduler.js';
import { ensureBuiltinSkills } from './services/volunteerService.js';
import { ensureBuiltinForms } from './services/formService.js';
import { ensureBuiltinResourceTypes } from './services/shelterService.js';
import { ensureBuiltinOrgs } from './services/orgService.js';
import { router as healthRouter } from './routes/health.js';
import { router as helpRouter } from './routes/help.js';
import { router as adminRouter } from './routes/admin.js';
import { router as authRouter } from './routes/auth.js';
import { router as complianceRouter } from './routes/compliance.js';
import { router as volunteerRouter } from './routes/volunteer.js';
import { router as formRouter } from './routes/form.js';
import { router as shelterRouter } from './routes/shelter.js';
import { router as floodRouter } from './routes/flood.js';
import { router as intakeRouter } from './routes/intake.js';
import { router as offerRouter } from './routes/offer.js';
import { router as matchRouter } from './routes/match.js';
import { router as manageRouter } from './routes/manage.js';
import { errorHandler } from './middlewares/error.js';
import { globalLimiter, strictLimiter } from './middlewares/rateLimit.js';

export async function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  // 上传文件静态访问(V1 本地磁盘兜底)
  app.use('/uploads', express.static(path.resolve(env.uploadDir)));

  // 前端静态托管(Docker/单服务部署时):/ -> H5,/admin -> 管理后台
  if (env.staticH5Dir) {
    app.use(express.static(env.staticH5Dir));
  }
  if (env.staticAdminDir) {
    app.use('/admin', express.static(env.staticAdminDir));
  }

  if (!env.isProd) app.use(morgan('dev'));

  // 全局限流(兜底,防最粗暴攻击)
  app.use('/api', globalLimiter);

  // 路由
  app.use('/api', healthRouter);
  app.use('/api', helpRouter);
  app.use('/api', adminRouter);
  app.use('/api', authRouter);
  app.use('/api', complianceRouter);
  app.use('/api', volunteerRouter);
  app.use('/api', formRouter);
  app.use('/api', shelterRouter);
  app.use('/api', floodRouter);
  app.use('/api', intakeRouter);
  app.use('/api', offerRouter);
  app.use('/api', matchRouter);
  app.use('/api', manageRouter);

  // 404
  app.use((req, res) => {
    res.status(404).json({ code: 404, message: `路径不存在: ${req.method} ${req.path}` });
  });

  app.use(errorHandler);
  return app;
}

async function main() {
  await connectDB();
  await ensureDevAdmin();
  await ensureBuiltinSkills();
  await ensureBuiltinForms();
  await ensureBuiltinResourceTypes();
  await ensureBuiltinOrgs();
  startScheduler();
  const app = await createApp();
  app.listen(env.port, () => {
    console.log(`[server] RescueFlow 已启动: http://localhost:${env.port}`);
    console.log(`[server] 环境: ${env.nodeEnv} | 健康检查: /api/health`);
  });
}

// 直接运行时启动;被云函数包装时不自动 listen
const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  main().catch((e) => {
    console.error('[server] 启动失败:', e);
    process.exit(1);
  });
}
