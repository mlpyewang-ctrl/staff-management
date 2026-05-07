export interface OvertimeExportRow {
  [key: string]: string | number
}

export interface LeaveExportRow {
  [key: string]: string | number
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return date.toLocaleDateString('zh-CN')
}

export function buildOvertimeExportRows(
  records: Array<{
    id: string
    userName: string
    departmentName?: string | null
    date: Date
    startTime: Date
    endTime: Date
    hours: number
    actualStartTime: Date | null
    actualEndTime: Date | null
    actualHours: number | null
    type: string
    reason: string
    status: string
    remark: string | null
    createdAt: Date
  }>
): OvertimeExportRow[] {
  return records.map((record) => ({
    记录ID: record.id,
    姓名: record.userName,
    部门: record.departmentName || '',
    日期: formatDate(record.date),
    计划开始时间: formatDateTime(record.startTime),
    计划结束时间: formatDateTime(record.endTime),
    计划时长: `${record.hours} 小时`,
    实际开始时间: record.actualStartTime ? formatDateTime(record.actualStartTime) : '',
    实际结束时间: record.actualEndTime ? formatDateTime(record.actualEndTime) : '',
    实际时长: record.actualHours ? `${record.actualHours} 小时` : '',
    类型: record.type,
    事由: record.reason,
    状态: record.status,
    备注: record.remark || '',
    创建时间: formatDateTime(record.createdAt),
  }))
}

export function buildLeaveExportRows(
  records: Array<{
    id: string
    userName: string
    departmentName?: string | null
    type: string
    startDate: Date
    endDate: Date
    days: number
    startSession: string | null
    endSession: string | null
    reason: string
    destination: string | null
    status: string
    remark: string | null
    createdAt: Date
  }>
): LeaveExportRow[] {
  return records.map((record) => ({
    记录ID: record.id,
    姓名: record.userName,
    部门: record.departmentName || '',
    类型: record.type,
    开始日期: formatDate(record.startDate),
    结束日期: formatDate(record.endDate),
    天数: `${record.days} 天`,
    开始时段: record.startSession || '',
    结束时段: record.endSession || '',
    事由: record.reason,
    目的地: record.destination || '',
    状态: record.status,
    备注: record.remark || '',
    创建时间: formatDateTime(record.createdAt),
  }))
}

export function buildQueryExcelContent(rows: Array<Record<string, string | number>>) {
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
