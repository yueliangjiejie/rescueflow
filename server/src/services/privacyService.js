/**
 * 隐私脱敏服务 —— 字段级脱敏(支撑"最小必要 + 不公开隐私")。
 *
 * 默认所有对外响应脱敏;仅在用户具备权限(如 operator/admin)且操作被留痕后,
 * 才返回明文(VIEW 敏感信息会写 audit)。
 */

/**
 * 手机号脱敏: 13812345678 -> 138****5678
 */
export function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const s = phone.replace(/\s+/g, '');
  if (s.length < 7) return s.replace(/.(?=.{1})/g, '*');
  return `${s.slice(0, 3)}****${s.slice(-4)}`;
}

/**
 * 姓名脱敏: 张三 -> 张*; 欧阳娜娜 -> 欧阳**
 */
export function maskName(name) {
  if (!name || typeof name !== 'string') return '';
  if (name.length <= 1) return '*';
  if (name.length === 2) return `${name[0]}*`;
  return `${name.slice(0, name.length > 3 ? 2 : 1)}${'*'.repeat(name.length - (name.length > 3 ? 2 : 1))}`;
}

/**
 * 对外脱敏一个求助对象(就地修改副本)。
 * @param {object} help
 * @param {object} opts { revealPhone, revealName } 是否返回明文
 */
export function maskHelp(help, opts = {}) {
  if (!help) return help;
  const out = help.toObject ? help.toObject() : { ...help };
  if (out.person) {
    out.person = { ...out.person };
    out.person.phone = opts.revealPhone ? out.person.phone : maskPhone(out.person.phone);
    out.person.name = opts.revealName ? out.person.name : maskName(out.person.name);
  }
  return out;
}

/**
 * 对数组批量脱敏。
 */
export function maskHelps(list, opts = {}) {
  return (list || []).map((h) => maskHelp(h, opts));
}
