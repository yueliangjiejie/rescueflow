/**
 * 文件上传中间件 —— multer 本地磁盘兜底。
 * V1 存本地 uploads/,后续接腾讯云 COS。
 */
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { env } from '../config/env.js';

// 确保上传目录存在
fs.mkdirSync(env.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, name);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req, file, cb) => {
    const ok = /^(voice|image|video)\//.test(file.mimetype);
    cb(ok ? null : new Error('仅支持语音/图片/视频'), ok);
  },
});
