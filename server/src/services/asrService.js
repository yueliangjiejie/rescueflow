/**
 * 语音转文字适配层(腾讯云一句话识别 ASR)。
 *
 * 设计:
 *  - 无 SDK 依赖,直接调腾讯云一句话识别 HTTP API(HMAC-SHA256 签名)。
 *  - 失败/未配置 → 降级返回空字符串,由调用方降级为人工处理。
 *  - 灾区方言识别准确率有限:此处只做转写,不做语义理解(语义交给 aiService 结构化)。
 *
 * 腾讯云 ASR 文档:
 *  https://cloud.tencent.com/document/product/1093/35646(一句话识别)
 */
import crypto from 'node:crypto';
import { env } from '../config/env.js';

function isConfigured() {
  return Boolean(env.tencentSecretId && env.tencentSecretKey);
}

/**
 * 生成腾讯云 API v3 签名(TC3-HMAC-SHA256)。
 */
async function buildSignedHeaders(action, payload, service = 'asr') {
  const host = 'asr.tencentcloudapi.com';
  const endpoint = `https://${host}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  // 1. 拼接规范请求串
  const httpRequestMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQueryString = '';
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const payloadStr = JSON.stringify(payload);
  const hashedRequestPayload = crypto.createHash('sha256').update(payloadStr).digest('hex');
  const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedRequestPayload}`;

  // 2. 拼接待签名串
  const algorithm = 'TC3-HMAC-SHA256';
  const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

  // 3. 计算签名
  const secretDate = crypto.createHmac('sha256', `TC3${env.tencentSecretKey}`).update(date).digest();
  const secretService = crypto.createHmac('sha256', secretDate).update(service).digest();
  const secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest();
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

  // 4. Authorization
  const authorization = `${algorithm} Credential=${env.tencentSecretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return {
    endpoint,
    body: payloadStr,
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json; charset=utf-8',
      Host: host,
      'X-TC-Action': action,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Version': '2019-06-14',
    },
  };
}

/**
 * 一句话识别:把音频 buffer 转成文字。
 * @param {Buffer} audioBuffer 音频原始字节(推荐 wav/pcm/mp3)
 * @param {object} opts { engType='16k_zh', fileType, sampleRate }
 * @returns {Promise<string>} 转写文本(失败返回 '')
 */
export async function recognizeOnce(audioBuffer, opts = {}) {
  if (!isConfigured() || !audioBuffer) return '';
  const engType = opts.engType || '16k_zh'; // 16k_zh 中文;16k_zh_dialect 方言
  const payload = {
    EngType: engType,
    SourceType: 1, // 1=直接传音频数据
    VoiceFormat: opts.fileType || 'wav',
    Data: audioBuffer.toString('base64'),
    UsrAudioKey: String(Date.now()),
  };

  try {
    const { endpoint, body, headers } = await buildSignedHeaders('SentenceRecognition', payload);
    const res = await fetch(endpoint, { method: 'POST', headers, body });
    const data = await res.json();
    if (data.Response?.Error) {
      console.warn('[asr] 腾讯云返回错误:', data.Response.Error.Message);
      return '';
    }
    return data.Response?.Result || '';
  } catch (e) {
    console.warn('[asr] 调用失败,降级:', e.message);
    return '';
  }
}

export const isAsrReady = isConfigured;
