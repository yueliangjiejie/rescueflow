/**
 * 求助路由(群众端登记 + 后台查询)。
 *
 *   POST /api/helps                 群众登记(核心)
 *   GET  /api/helps                 列表(后台,阶段2加鉴权)
 *   GET  /api/helps/:code           详情
 *   POST /api/helps/upload          上传语音/图片,返回附件引用
 */
import { Router } from 'express';
import path from 'node:path';
import { asyncHandler } from '../middlewares/error.js';
import { ok } from '../utils/response.js';
import { maskHelp, maskHelps } from '../services/privacyService.js';
import { createHelp, listHelps, getHelp } from '../services/helpService.js';
import { upload } from '../middlewares/upload.js';
import { Attachment } from '../models/Attachment.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { env } from '../config/env.js';
import { genId } from '../services/idService.js';
import { ID_PREFIX, AttachmentType } from '@rescueflow/shared';

export const router = Router();

// 群众登记
router.post(
  '/helps',
  asyncHandler(async (req, res) => {
    const doc = await createHelp({
      rawText: req.body.rawText,
      transcript: req.body.transcript,
      method: req.body.method,
      reporterRelation: req.body.reporterRelation,
      person: req.body.person,
      location: req.body.location,
      attachments: req.body.attachments,
      consent: req.body.consent,
      formId: req.body.formId,
      formData: req.body.formData,
      submittedAt: req.body.submittedAt ? new Date(req.body.submittedAt) : new Date(),
      source: req.body.source || 'h5',
      actorId: req.body.actorId || req.headers['x-openid'] || 'anonymous',
    });
    res.status(201).json(ok({ code: doc.code, urgency: doc.urgency }, '登记成功,待核实'));
  })
);

// 列表(脱敏)
router.get(
  '/helps',
  asyncHandler(async (req, res) => {
    const result = await listHelps({
      status: req.query.status,
      urgency: req.query.urgency,
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 20,
    });
    res.json(ok({ ...result, items: maskHelps(result.items) }));
  })
);

// 详情(脱敏)
router.get(
  '/helps/:code',
  asyncHandler(async (req, res) => {
    const doc = await getHelp(req.params.code);
    if (!doc) return res.status(404).json(ok(null, '未找到'));
    res.json(ok(maskHelp(doc)));
  })
);

// 上传(语音/图片)
router.post(
  '/helps/upload',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json(ok(null, '未提供文件'));
    // sha256 完整性
    const buf = fs.readFileSync(req.file.path);
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

    const isVoice = req.file.mimetype.startsWith('voice') || req.file.mimetype.startsWith('audio');
    const code = await genId(ID_PREFIX.HELP, { region: 'GX' }); // 附件复用自增,避免另建计数器
    const storeKey = `${isVoice ? 'voice' : 'image'}/${path.basename(req.file.path)}`;
    const { save } = await import('../services/storageService.js');
    const url = await save(req.file.path, storeKey); // COS 优先,降级本地
    const att = await Attachment.create({
      code,
      type: isVoice ? AttachmentType.VOICE : AttachmentType.IMAGE,
      url,
      size: req.file.size,
      mimeType: req.file.mimetype,
      sha256,
      duration: req.body.duration ? Number(req.body.duration) : null,
      uploadedBy: req.headers['x-openid'] || 'anonymous',
    });
    res.status(201).json(ok({ id: att._id, code: att.code, url: att.url, type: att.type }));
  })
);

