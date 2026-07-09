/**
 * 表单服务 —— 多灾种自定义表单管理(借鉴 Ushahidi)。
 */
import { Form, BUILTIN_FORMS } from '../models/Form.js';

/** 初始化内置表单(幂等)。 */
export async function ensureBuiltinForms() {
  for (const f of BUILTIN_FORMS) {
    await Form.updateOne({ slug: f.slug }, { $setOnInsert: f }, { upsert: true }).exec();
  }
}

export async function listForms({ includeDisabled = false } = {}) {
  const filter = includeDisabled ? {} : { disabled: false };
  return Form.find(filter).sort('name').lean().exec();
}

export async function getForm(slug) {
  return Form.findOne({ slug }).lean().exec();
}

export async function createForm(data) {
  return Form.create(data);
}

/**
 * 校验自定义表单数据:required 的属性必须填写。
 * 用于求助提交时验证 formData 完整性。
 * 返回 { ok, missing: [...] }。
 */
export function validateFormData(form, formData = {}) {
  if (!form || !Array.isArray(form.stages)) return { ok: true, missing: [] };
  const missing = [];
  for (const stage of form.stages) {
    if (!stage.required) continue;
    for (const attr of stage.attributes || []) {
      if (attr.required && (formData[attr.key] === undefined || formData[attr.key] === '' || formData[attr.key] === null)) {
        missing.push({ stage: stage.label, key: attr.key, label: attr.label });
      }
    }
  }
  return { ok: missing.length === 0, missing };
}
