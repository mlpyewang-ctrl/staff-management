import { calculateHourlyRate, formatDateTime } from './utils'

export interface SalaryExportRecord {
  id: string
  userId: string
  month: string
  baseSalary: number
  seniorityPay: number
  otherAdjustment: number
  adjustmentNote?: string | null
  workdayOvertimeHours: number
  workdayOvertimePay: number
  weekendOvertimeHours: number
  weekendOvertimePay: number
  holidayOvertimeHours: number
  holidayOvertimePay: number
  totalOvertimePay: number
  compensatoryHours: number
  deduction: number
  netSalary: number
  status: string
  paidAt?: Date | string | null
  createdAt: Date | string
  updatedAt?: Date | string
  userName?: string
  departmentName?: string | null
  positionName?: string | null
  user?: {
    email?: string | null
    level?: string | null
  }
}

export interface SalaryExportRow {
  [key: string]: string | number
}

export function getSalaryStatusLabel(status: string) {
  const statusMap: Record<string, string> = {
    DRAFT: '草稿',
    CONFIRMED: '已确认',
    PAID: '已支付',
  }

  return statusMap[status] || status
}

function toDate(value?: Date | string | null) {
  if (!value) {
    return null
  }

  return value instanceof Date ? value : new Date(value)
}

export function buildSalaryExportRows(records: SalaryExportRecord[]): SalaryExportRow[] {
  return records.map((record) => {
    const paidOvertimeHours =
      record.workdayOvertimeHours + record.weekendOvertimeHours + record.holidayOvertimeHours
    const totalOvertimeHours = paidOvertimeHours + record.compensatoryHours
    const hourlySalary = Math.round(calculateHourlyRate(record.baseSalary + record.seniorityPay) * 100) / 100

    return {
      薪资单ID: record.id,
      员工ID: record.userId,
      姓名: record.userName || '',
      邮箱: record.user?.email || '',
      部门: record.departmentName || '',
      岗位: record.positionName || '',
      职级: record.user?.level || '',
      月份: record.month,
      基本工资: record.baseSalary,
      工龄工资: record.seniorityPay,
      其他调整: record.otherAdjustment,
      调整说明: record.adjustmentNote || '',
      小时工资: hourlySalary,
      工作日加班时长: record.workdayOvertimeHours,
      工作日加班费: record.workdayOvertimePay,
      周末加班时长: record.weekendOvertimeHours,
      周末加班费: record.weekendOvertimePay,
      法定节假日加班时长: record.holidayOvertimeHours,
      法定节假日加班费: record.holidayOvertimePay,
      计薪加班时长: paidOvertimeHours,
      加班费合计: record.totalOvertimePay,
      调休时长: record.compensatoryHours,
      总加班时长: totalOvertimeHours,
      扣款: record.deduction,
      应发工资: record.netSalary,
      状态: getSalaryStatusLabel(record.status),
      支付时间: toDate(record.paidAt) ? formatDateTime(toDate(record.paidAt) as Date) : '',
      创建时间: formatDateTime(toDate(record.createdAt) as Date),
      更新时间: toDate(record.updatedAt) ? formatDateTime(toDate(record.updatedAt) as Date) : '',
    }
  })
}

export function buildSalaryExcelContent(rows: SalaryExportRow[]) {
  if (rows.length === 0) {
    return ''
  }

  const headers = Object.keys(rows[0])
  const escapeCell = (value: string | number) =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const headerHtml = headers
    .map(
      (header) =>
        `<th style="border:1px solid #cbd5e1;background:#eff6ff;padding:8px 12px;text-align:left;">${escapeCell(header)}</th>`
    )
    .join('')

  const bodyHtml = rows
    .map((row) => {
      const cells = headers
        .map(
          (header) =>
            `<td style="border:1px solid #cbd5e1;padding:8px 12px;">${escapeCell(row[header])}</td>`
        )
        .join('')

      return `<tr>${cells}</tr>`
    })
    .join('')

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8" />
      </head>
      <body>
        <table>
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </body>
    </html>
  `
}
