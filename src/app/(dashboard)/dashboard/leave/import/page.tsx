'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { parseLeaveExcel, type ParsedLeaveRow } from '@/lib/excel-parser'
import { batchImportLeave } from '@/server/actions/leave'

const leaveTypeMap: Record<string, string> = {
  ANNUAL: '年假',
  SICK: '病假',
  PERSONAL: '事假',
  MARRIAGE: '婚假',
  MATERNITY: '产假',
  PATERNITY: '陪产假',
  COMPENSATORY: '调休',
}

export default function LeaveImportPage() {
  const router = useRouter()
  const [fileName, setFileName] = useState<string>('')
  const [parsedRows, setParsedRows] = useState<ParsedLeaveRow[]>([])
  const [parseErrors, setParseErrors] = useState<Array<{ rowIndex: number; message: string }>>([])
  const [isImporting, setIsImporting] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('请上传 .xlsx 或 .xls 格式的 Excel 文件')
      return
    }

    setFileName(file.name)
    const buffer = await file.arrayBuffer()
    const result = parseLeaveExcel(buffer)
    setParsedRows(result.data)
    setParseErrors(result.errors)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0])
      }
    },
    [handleFile]
  )

  const handleImport = useCallback(async () => {
    if (parsedRows.length === 0) {
      alert('没有可导入的数据')
      return
    }

    setIsImporting(true)
    const result = await batchImportLeave(parsedRows)
    setIsImporting(false)

    if (result.error) {
      alert(result.error)
    } else {
      alert(result.success)
      router.push('/dashboard/leave')
    }
  }, [parsedRows, router])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">请假批量导入</h1>
        <p className="mt-2 text-sm text-slate-600">
          上传 Excel 文件批量导入请假记录，导入后状态为已完成，无需审批。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>上传文件</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center transition-colors hover:border-slate-400 hover:bg-slate-100"
          >
            <div className="text-4xl mb-4">📄</div>
            <p className="text-sm text-slate-600">
              拖拽 Excel 文件到此处，或{' '}
              <label className="cursor-pointer font-medium text-sky-600 hover:text-sky-700">
                点击选择
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFile(e.target.files[0])
                    }
                  }}
                />
              </label>
            </p>
            <p className="mt-2 text-xs text-slate-400">支持 .xlsx、.xls 格式</p>
            {fileName && (
              <p className="mt-3 text-sm font-medium text-slate-700">
                已选择：{fileName}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {parseErrors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">解析错误（共 {parseErrors.length} 条）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-60 overflow-auto space-y-1 text-sm text-red-700">
              {parseErrors.map((err, idx) => (
                <div key={idx}>
                  第 {err.rowIndex} 行：{err.message}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {parsedRows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>数据预览（共 {parsedRows.length} 条）</CardTitle>
              <p className="mt-1 text-sm text-slate-500">请确认数据无误后点击导入</p>
            </div>
            <Button
              onClick={handleImport}
              disabled={isImporting || parseErrors.length > 0}
            >
              {isImporting ? '导入中...' : '确认导入'}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>员工用户名</TableHead>
                    <TableHead>员工姓名</TableHead>
                    <TableHead>请假类型</TableHead>
                    <TableHead>开始日期</TableHead>
                    <TableHead>结束日期</TableHead>
                    <TableHead>时段</TableHead>
                    <TableHead>事由</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row) => (
                    <TableRow key={row.rowIndex}>
                      <TableCell>{row.username}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{leaveTypeMap[row.type] || row.type}</TableCell>
                      <TableCell>{row.startDate}</TableCell>
                      <TableCell>{row.endDate}</TableCell>
                      <TableCell>
                        {row.startSession === 'AM' ? '上午' : '下午'} 至{' '}
                        {row.endSession === 'AM' ? '上午' : '下午'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{row.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
