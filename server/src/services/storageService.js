/**
 * 对象存储适配层 —— 配置了腾讯云 COS 就用 COS,否则降级为本地磁盘。
 *
 * 灾时价值:服务器磁盘会满,COS 提供海量、持久、CDN 加速的对象存储。
 *
 * 使用:
 *   const { save } = useStorage();
 *   const url = await save(localPath, key); // 返回访问 URL
 */
import path from 'node:path';
import { env } from '../config/env.js';

let _cos = null;
function isCosConfigured() {
  return Boolean(env.cosSecretId && env.cosSecretKey && env.cosBucket);
}

async function getCos() {
  if (_cos !== null) return _cos;
  if (!isCosConfigured()) {
    _cos = false;
    return null;
  }
  try {
    const mod = await import('cos-nodejs-sdk-v5');
    const COS = mod.default || mod;
    _cos = new COS({
      SecretId: env.cosSecretId,
      SecretKey: env.cosSecretKey,
    });
    return _cos;
  } catch (e) {
    console.warn('[storage] COS SDK 加载失败,降级本地:', e.message);
    _cos = false;
    return null;
  }
}

/**
 * 保存本地文件到存储,返回访问 URL。
 * @param {string} localPath 本地临时文件路径
 * @param {string} key 存储对象 key(如 voice/xxx.webm)
 * @returns {Promise<string>} 可访问 URL
 */
export async function save(localPath, key) {
  const cos = await getCos();
  if (!cos) {
    // 降级:本地路径
    return '/' + path.relative(process.cwd(), localPath);
  }
  try {
    await cos.putObject({
      Bucket: env.cosBucket,
      Region: env.cosRegion,
      Key: key,
      FilePath: localPath,
    });
    return `https://${env.cosBucket}.cos.${env.cosRegion}.myqcloud.com/${key}`;
  } catch (e) {
    console.warn('[storage] COS 上传失败,降级本地:', e.message);
    return '/' + path.relative(process.cwd(), localPath);
  }
}

/**
 * 删除存储对象(清理时用)。
 */
export async function remove(key) {
  const cos = await getCos();
  if (!cos) return;
  try {
    await cos.deleteObject({ Bucket: env.cosBucket, Region: env.cosRegion, Key: key });
  } catch (e) {
    console.warn('[storage] COS 删除失败:', e.message);
  }
}

export const isCosReady = isCosConfigured;
export const useStorage = () => ({ save, remove });
