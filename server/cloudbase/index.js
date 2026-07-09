/**
 * 腾讯云 CloudBase 云函数入口包装。
 *
 * 把 server/src/app.js 的 Express app 适配为 CloudBase 的 SCF 事件处理函数。
 * 本地直接运行 src/app.js;云函数部署时用本文件作为 handler。
 *
 * 部署方式:
 *   1. 在 CloudBase 控制台创建 Node.js 云函数 rescueflow-api
 *   2. 上传 server/ 目录(含 node_modules 与 cloudbase/)
 *   3. 入口指向 cloudbase/index.handler
 *   4. 环境变量在云函数配置中注入(见 .env.example)
 */
import serverless from 'serverless-http';
import { createApp } from '../src/app.js';
import { connectDB } from '../src/config/db.js';

let cached = null;

async function bootstrap() {
  if (cached) return cached;
  await connectDB();
  const app = await createApp();
  cached = { app, handler: serverless(app) };
  return cached;
}

export const handler = async (event, context) => {
  const { handler } = await bootstrap();
  return handler(event, context);
};
