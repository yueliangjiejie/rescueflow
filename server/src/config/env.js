/**
 * 环境变量集中读取 —— 单一来源,避免散落各处。
 * 缺失关键变量时抛错,让部署问题尽早暴露。
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// 从 server/.env 读取;CI/CloudBase 用注入的环境变量覆盖
dotenv.config({ path: join(__dirname, '../../.env') });

function required(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`[env] 缺少必要环境变量: ${name}`);
  }
  return v;
}

function optional(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

// 提前算出运行环境,供下方条件逻辑复用
const isProd = optional('NODE_ENV', 'development') === 'production';

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: Number(optional('PORT', 3000)),
  isProd,

  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/rescueflow'),

  // 微信 H5 登录(可空,V1 可先用匿名/手机号兜底)
  wxAppId: optional('WX_APPID', ''),
  wxSecret: optional('WX_SECRET', ''),

  // 腾讯地图
  tencentMapKey: optional('TENCENT_MAP_KEY', ''),

  // AI
  aiApiBase: optional('AI_API_BASE', 'https://api.openai.com/v1'),
  aiApiKey: optional('AI_API_KEY', ''),
  aiModel: optional('AI_MODEL', 'gpt-4o-mini'),

  // 腾讯云 ASR(语音转文字)
  // 申请: https://console.cloud.tencent.com/asr
  tencentSecretId: optional('TENCENT_SECRET_ID', ''),
  tencentSecretKey: optional('TENCENT_SECRET_KEY', ''),
  tencentAsrAppId: optional('TENCENT_ASR_APP_ID', ''),

  // 对象存储(语音/图片,配置了用腾讯云 COS,否则降级本地磁盘)
  uploadDir: optional('UPLOAD_DIR', './uploads'),
  cosSecretId: optional('COS_SECRET_ID', ''),
  cosSecretKey: optional('COS_SECRET_KEY', ''),
  cosBucket: optional('COS_BUCKET', ''),
  cosRegion: optional('COS_REGION', 'ap-guangzhou'),

  // 前端静态托管(Docker 部署时由后端提供 H5/后台)
  staticH5Dir: optional('STATIC_H5_DIR', ''),
  staticAdminDir: optional('STATIC_ADMIN_DIR', ''),

  // JWT —— 生产环境必须显式配置密钥,开发环境保留默认值方便本地调试
  jwtSecret: isProd
    ? required('JWT_SECRET')
    : optional('JWT_SECRET', 'dev-only-change-me'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '7d'),

  // 合规
  dataRetentionDays: Number(optional('DATA_RETENTION_DAYS', 365)),
};
