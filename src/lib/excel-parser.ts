import * as XLSX from 'xlsx'

export interface ParsedOvertimeRow {
  rowIndex: number
  username: string
  name: string
  date: string
  startTime: string
  endTime: string
  type: 'WORKDAY' | 'WEEKEND' | 'HOLIDAY'
  reason: string
}

export interface ParsedLeaveRow {
  rowIndex: number
  username: string
  name: string
  type: 'ANNUAL' | 'SICK' | 'PERSONAL' | 'MARRIAGE' | 'MATERNITY' | 'PATERNITY' | 'COMPENSATORY'
  startDate: string
  endDate: string
  startSession: 'AM' | 'PM'
  endSession: 'AM' | 'PM'
  reason: string
  destination: string
}

export interface ParseResult<T> {
  data: T[]
  errors: Array<{ rowIndex: number; message: string }>
}

function parseExcelDate(value: unknown): string | null {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
    }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed
    }
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmed)) {
      return trimmed.replace(/\//g, '-')
    }
  }
  return null
}

function parseExcelTime(value: unknown): string | null {
  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
  }
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (date) {
      return `${String(date.H).padStart(2, '0')}:${String(date.M).padStart(2, '0')}`
    }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
      const [h, m] = trimmed.split(':')
      return `${String(Number(h)).padStart(2, '0')}:${m}`
    }
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) {
      const [h, m] = trimmed.split(':')
      return `${String(Number(h)).padStart(2, '0')}:${m}`
    }
  }
  return null
}

function getCellValue(sheet: XLSX.WorkSheet, row: number, col: number): unknown {
  const cellRef = XLSX.utils.encode_cell({ r: row, c: col })
  const cell = sheet[cellRef]
  return cell ? cell.v : undefined
}

export function parseOvertimeExcel(buffer: ArrayBuffer): ParseResult<ParsedOvertimeRow> {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')

  const data: ParsedOvertimeRow[] = []
  const errors: Array<{ rowIndex: number; message: string }> = []

  for (let row = 1; row <= range.e.r; row++) {
    const username = String(getCellValue(sheet, row, 0) || '').trim()
    const name = String(getCellValue(sheet, row, 1) || '').trim()
    const dateValue = getCellValue(sheet, row, 2)
    const startTimeValue = getCellValue(sheet, row, 3)
    const endTimeValue = getCellValue(sheet, row, 4)
    const typeValue = String(getCellValue(sheet, row, 5) || '').trim().toUpperCase()
    const reason = String(getCellValue(sheet, row, 6) || '').trim()

    if (!username && !name && !dateValue && !reason) {
      continue
    }

    const rowIndex = row + 1
    const rowErrors: string[] = []

    if (!username) rowErrors.push('员工用户名不能为空')
    if (!dateValue) rowErrors.push('加班日期不能为空')
    if (!startTimeValue) rowErrors.push('开始时间不能为空')
    if (!endTimeValue) rowErrors.push('结束时间不能为空')
    if (!typeValue) rowErrors.push('加班类型不能为空')
    if (!reason) rowErrors.push('加班事由不能为空')

    const date = parseExcelDate(dateValue)
    if (dateValue && !date) rowErrors.push('加班日期格式错误，应为 yyyy-MM-dd')

    const startTime = parseExcelTime(startTimeValue)
    if (startTimeValue && !startTime) rowErrors.push('开始时间格式错误，应为 HH:mm')

    const endTime = parseExcelTime(endTimeValue)
    if (endTimeValue && !endTime) rowErrors.push('结束时间格式错误，应为 HH:mm')

    const validTypes = ['WORKDAY', 'WEEKEND', 'HOLIDAY']
    if (typeValue && !validTypes.includes(typeValue)) {
      rowErrors.push('加班类型错误，应为 WORKDAY/WEEKEND/HOLIDAY')
    }

    if (rowErrors.length > 0) {
      errors.push({ rowIndex, message: rowErrors.join('；') })
      continue
    }

    data.push({
      rowIndex,
      username,
      name,
      date: date!,
      startTime: startTime!,
      endTime: endTime!,
      type: typeValue as 'WORKDAY' | 'WEEKEND' | 'HOLIDAY',
      reason,
    })
  }

  return { data, errors }
}

export function parseLeaveExcel(buffer: ArrayBuffer): ParseResult<ParsedLeaveRow> {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')

  const data: ParsedLeaveRow[] = []
  const errors: Array<{ rowIndex: number; message: string }> = []

  for (let row = 1; row <= range.e.r; row++) {
    const username = String(getCellValue(sheet, row, 0) || '').trim()
    const name = String(getCellValue(sheet, row, 1) || '').trim()
    const typeValue = String(getCellValue(sheet, row, 2) || '').trim().toUpperCase()
    const startDateValue = getCellValue(sheet, row, 3)
    const endDateValue = getCellValue(sheet, row, 4)
    const startSessionValue = String(getCellValue(sheet, row, 5) || '').trim().toUpperCase()
    const endSessionValue = String(getCellValue(sheet, row, 6) || '').trim().toUpperCase()
    const reason = String(getCellValue(sheet, row, 7) || '').trim()
    const destination = String(getCellValue(sheet, row, 8) || '').trim()

    if (!username && !name && !startDateValue && !reason) {
      continue
    }

    const rowIndex = row + 1
    const rowErrors: string[] = []

    if (!username) rowErrors.push('员工用户名不能为空')
    if (!typeValue) rowErrors.push('请假类型不能为空')
    if (!startDateValue) rowErrors.push('开始日期不能为空')
    if (!endDateValue) rowErrors.push('结束日期不能为空')
    if (!reason) rowErrors.push('请假事由不能为空')

    const validTypes = ['ANNUAL', 'SICK', 'PERSONAL', 'MARRIAGE', 'MATERNITY', 'PATERNITY', 'COMPENSATORY']
    if (typeValue && !validTypes.includes(typeValue)) {
      rowErrors.push('请假类型错误，应为 ANNUAL/SICK/PERSONAL/MARRIAGE/MATERNITY/PATERNITY/COMPENSATORY')
    }

    const startDate = parseExcelDate(startDateValue)
    if (startDateValue && !startDate) rowErrors.push('开始日期格式错误，应为 yyyy-MM-dd')

    const endDate = parseExcelDate(endDateValue)
    if (endDateValue && !endDate) rowErrors.push('结束日期格式错误，应为 yyyy-MM-dd')

    const validSessions = ['AM', 'PM']
    const startSession = (startSessionValue || 'AM') as 'AM' | 'PM'
    const endSession = (endSessionValue || 'PM') as 'AM' | 'PM'
    if (startSessionValue && !validSessions.includes(startSessionValue)) rowErrors.push('开始时段错误，应为 AM/PM')
    if (endSessionValue && !validSessions.includes(endSessionValue)) rowErrors.push('结束时段错误，应为 AM/PM')

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      rowErrors.push('开始日期不能晚于结束日期')
    }

    if (rowErrors.length > 0) {
      errors.push({ rowIndex, message: rowErrors.join('；') })
      continue
    }

    data.push({
      rowIndex,
      username,
      name,
      type: typeValue as ParsedLeaveRow['type'],
      startDate: startDate!,
      endDate: endDate!,
      startSession,
      endSession,
      reason,
      destination,
    })
  }

  return { data, errors }
}

export function generateOvertimeTemplate(): ArrayBufferLike {
  const headers = ['员工用户名', '员工姓名', '加班日期', '开始时间', '结束时间', '加班类型', '加班事由']
  const note = [
    '（说明）',
    '填写系统中唯一的用户名',
    '与系统一致的真实姓名',
    '格式 yyyy-MM-dd，如 2026-05-10',
    '格式 HH:mm，如 18:00',
    '格式 HH:mm，如 21:00',
    'WORKDAY（工作日）/ WEEKEND（周末）/ HOLIDAY（节假日）',
    '必填，简述加班原因',
  ]
  const example = [
    'wangqiang',
    '王强',
    '2026-05-10',
    '18:00',
    '21:00',
    'WORKDAY',
    '项目紧急上线支持',
  ]
  const sheet = XLSX.utils.aoa_to_sheet([headers, note, example])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '加班导入模板')
  const result = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return result instanceof ArrayBuffer ? result : (result as Uint8Array).buffer
}

export function generateLeaveTemplate(): ArrayBufferLike {
  const headers = ['员工用户名', '员工姓名', '请假类型', '开始日期', '结束日期', '开始时段', '结束时段', '请假事由', '前往地点']
  const note = [
    '（说明）',
    '填写系统中唯一的用户名',
    '与系统一致的真实姓名',
    'ANNUAL（年假）/ SICK（病假）/ PERSONAL（事假）/ MARRIAGE（婚假）/ MATERNITY（产假）/ PATERNITY（陪产假）/ COMPENSATORY（调休）',
    '格式 yyyy-MM-dd',
    '格式 yyyy-MM-dd',
    'AM（上午）/ PM（下午），默认 AM',
    'AM（上午）/ PM（下午），默认 PM',
    '必填，简述请假原因',
    '选填',
  ]
  const example = [
    'wangqiang',
    '王强',
    'ANNUAL',
    '2026-05-10',
    '2026-05-12',
    'AM',
    'PM',
    '家中有事需要处理',
    '山东老家',
  ]
  const sheet = XLSX.utils.aoa_to_sheet([headers, note, example])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '请假导入模板')
  const result = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return result instanceof ArrayBuffer ? result : (result as Uint8Array).buffer
}
