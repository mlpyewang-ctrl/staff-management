import { formatDateTime } from './utils'

export interface SalaryExportRecord {
  id: string
  userId: string
  month: string
  baseSalary: number
  seniorityPay: number
  otherAdjustment: number
  classLeaderAllowance: number
  dormHeadAllowance: number
  electricityAllowance: number
  supplementalPay: number
  deductionAdjustment: number
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
    username?: string | null
    level?: string | null
    educationSalary?: number | null
  }
}

export interface SalaryExportRow {
  [key: string]: string | number
}

function toDate(value?: Date | string | null) {
  if (!value) {
    return null
  }

  return value instanceof Date ? value : new Date(value)
}

export function buildSalaryExportRows(records: SalaryExportRecord[]): SalaryExportRow[] {
  return records.map((record) => {
    const educationSalary = record.user?.educationSalary ?? 0
    const pureBaseSalary = record.baseSalary - educationSalary

    return {
      姓名: record.userName || '',
      基础工资: pureBaseSalary,
      工龄工资: record.seniorityPay,
      学历工资: educationSalary,
      班长补助: record.classLeaderAllowance,
      宿舍负责人补助: record.dormHeadAllowance,
      电费补助: record.electricityAllowance,
      加班费: record.totalOvertimePay,
      补发工资: record.supplementalPay,
      补扣工资: record.deductionAdjustment,
      请假: record.deduction,
      小计: record.netSalary,
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
