/**
 * 地图适配层 —— 腾讯地图(逆地址解析)。
 *
 * 降级原则:无 key 或调用失败时,保留群众原始地址,不阻塞登记。
 */
import { env } from '../config/env.js';

/**
 * 逆地址解析:经纬度 -> 标准化地址。
 * 腾讯地图 reverseGeocoder 接口。
 * @param {number} lng
 * @param {number} lat
 */
export async function reverseGeocode(lng, lat) {
  if (!env.tencentMapKey) return null;
  if (lng == null || lat == null) return null;
  try {
    const url = `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat},${lng}&key=${env.tencentMapKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 0) {
      console.warn('[geo] 逆解析失败:', data.message);
      return null;
    }
    const a = data.result.address_component;
    return {
      address: data.result.address || '',
      province: a.province || '',
      city: a.city || '',
      district: a.district || '',
      confidence: 1,
    };
  } catch (e) {
    console.warn('[geo] 调用失败,降级:', e.message);
    return null;
  }
}
