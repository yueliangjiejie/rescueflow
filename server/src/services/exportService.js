/**
 * Excel 导出服务(ExcelJS)。
 * 按筛选导出求助明细,默认含脱敏手机号(授权后才导明文)。
 */
import ExcelJS from 'exceljs';
import { Help } from '../models/Help.js';
import { URGENCY_LABELS, HELP_ABNORMAL_LABELS } from '@rescueflow/shared';
import { CREDIBILITY } from '@rescueflow/shared';
import { maskPhone } from './privacyService.js';

const STATUS_LABELS = {
  pending: '待核实',
  verified: '已核实',
  transferred: '已转交',
  in_progress: '处理中',
  done: '已完成',
  archived: '已归档',
  abnormal: '异常',
};

export async function exportHelpsToBuffer({ filter = {}, revealPhone = false } = {}) {
  const list = await Help.find(filter).sort({ submittedAt: 1 }).lean().exec();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'RescueFlow';
  wb.created = new Date();
  const ws = wb.addWorksheet('求助明细');

  ws.columns = [
    { header: '编号', key: 'code', width: 22 },
    { header: '状态', key: 'status', width: 10 },
    { header: '紧急度', key: 'urgency', width: 8 },
    { header: '可信度', key: 'credibility', width: 10 },
    { header: '姓名', key: 'name', width: 12 },
    { header: '手机号', key: 'phone', width: 16 },
    { header: '受困人数', key: 'headcount', width: 9 },
    { header: '特殊人员', key: 'special', width: 18 },
    { header: '摘要', key: 'summary', width: 40 },
    { header: '地址', key: 'address', width: 30 },
    { header: '提交时间', key: 'submittedAt', width: 20 },
    { header: '转交去向', key: 'transferredTo', width: 16 },
    { header: '异常原因', key: 'abnormal', width: 12 },
  ];

  // 表头加粗
  ws.getRow(1).font = { bold: true };

  for (const h of list) {
    const p = h.person || {};
    ws.addRow({
      code: h.code,
      status: STATUS_LABELS[h.status] || h.status,
      urgency: URGENCY_LABELS[h.urgency] || h.urgency,
      credibility: '★'.repeat(h.credibility || 0),
      name: p.name || '',
      phone: revealPhone ? p.phone : maskPhone(p.phone),
      headcount: p.headcount || 1,
      special: (p.specialPersons || []).join('、'),
      summary: h.content?.summary || h.content?.rawText || '',
      address: h.location?.address || h.location?.raw || '',
      submittedAt: h.submittedAt ? new Date(h.submittedAt).toLocaleString('zh-CN') : '',
      transferredTo: h.transferredTo || '',
      abnormal: h.abnormalReason ? HELP_ABNORMAL_LABELS[h.abnormalReason] : '',
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
