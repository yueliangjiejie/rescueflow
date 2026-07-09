/**
 * 附件模型 —— 语音/图片。独立集合以便复用、留痕、完整性校验。
 * V1 用本地磁盘兜底,后续接腾讯云 COS。
 */
import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    code: { type: String, index: true },
    type: { type: String, enum: ['voice', 'image', 'video'], required: true, index: true },
    url: { type: String, required: true }, // 本地路径 / 对象存储 URL
    size: { type: Number, default: 0 },
    mimeType: { type: String, default: '' },
    duration: { type: Number, default: null }, // 语音时长(秒)
    sha256: { type: String, default: '' }, // 完整性校验
    uploadedBy: { type: String, default: '' },
  },
  { timestamps: true, collection: 'attachments' }
);

export const Attachment = mongoose.model('Attachment', attachmentSchema);
