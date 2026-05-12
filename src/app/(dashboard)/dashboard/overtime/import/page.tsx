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
import { parseOvertimeExcel, type ParsedOvertimeRow } from '@/lib/excel-parser'
import { batchImportOvertime } from '@/server/actions/overtime'

export default function OvertimeImportPage() {
  const router = useRouter()
  const [fileName, setFileName] = useState<string>('')
  const [parsedRows, setParsedRows] = useState<ParsedOvertimeRow[]>([])
  const [parseErrors, setParseErrors] = useState<Array<{ rowIndex: number; message: string }>>([])
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [isImporting, setIsImporting] = useState(false)

  const errorRowIndices = new Set(parseErrors.map((e) => e.rowIndex))
  const validRows = parsedRows.filter((r) => !errorRowIndices.has(r.rowIndex))
  const selectedValidRows = validRows.filter((r) => selectedRows.has(r.rowIndex))

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('请上传 .xlsx 或 .xls 格式的 Excel 文件')
      return
    }

    setFileName(file.name)
    const buffer = await file.arrayBuffer()
    const result = parseOvertimeExcel(buffer)
    setParsedRows(result.data)
    setParseErrors(result.errors)

    // 默认选中所有无错误的行
    const validIndices = new Set<number>()
    const errIndices = new Set(result.errors.map((e) => e.rowIndex))
    for (const row of result.data) {
      if (!errIndices.has(row.rowIndex)) {
        validIndices.add(row.rowIndex)
      }
    }
    setSelectedRows(validIndices)
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

  const toggleRow = (rowIndex: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(rowIndex)) {
        next.delete(rowIndex)
      } else {
        next.add(rowIndex)
      }
      return next
    })
  }

  const toggleAllValid = () => {
    const validIndices = validRows.map((r) => r.rowIndex)
    const allSelected = validIndices.every((i) => selectedRows.has(i))
    if (allSelected) {
      setSelectedRows((prev) => {
        const next = new Set(prev)
        for (const i of validIndices) {
          next.delete(i)
        }
        return next
      })
    } else {
      setSelectedRows((prev) => {
        const next = new Set(prev)
        for (const i of validIndices) {
          next.add(i)
        }
        return next
      })
    }
  }

  const handleImport = useCallback(async () => {
    if (selectedValidRows.length === 0) {
      alert('没有选中的可导入数据')
      return
    }

    setIsImporting(true)
    const result = await batchImportOvertime(selectedValidRows)
    setIsImporting(false)

    if (result.error) {
      alert(result.error)
    } else {
      alert(result.success)
      router.push('/dashboard/overtime')
    }
  }, [selectedValidRows, router])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">加班批量导入</h1>
        <p className="mt-2 text-sm text-slate-600">
          上传 Excel 文件批量导入加班记录，导入后状态为已完成，无需审批。
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
            <CardTitle className="text-red-700">解析错误（共 {parseErrors.length} 条，已跳过）</CardTitle>
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
              <CardTitle>数据预览（共 {parsedRows.length} 条，已选中 {selectedValidRows.length} 条）</CardTitle>
              <p className="mt-1 text-sm text-slate-500">解析错误的行已标记，可勾选需要导入的行</p>
            </div>
            <Button
              onClick={handleImport}
              disabled={isImporting || selectedValidRows.length === 0}
            >
              {isImporting ? '导入中...' : `确认导入 (${selectedValidRows.length} 条)`}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={validRows.length > 0 && validRows.every((r) => selectedRows.has(r.rowIndex))}
                        onChange={toggleAllValid}
                        className="h-4 w-4 cursor-pointer"
                      />
                    </TableHead>
                    <TableHead>员工用户名</TableHead>
                    <TableHead>员工姓名</TableHead>
                    <TableHead>加班日期</TableHead>
                    <TableHead>开始时间</TableHead>
                    <TableHead>结束时间</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>事由</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row) => {
                    const hasError = errorRowIndices.has(row.rowIndex)
                    return (
                      <TableRow
                        key={row.rowIndex}
                        className={hasError ? 'bg-red-50' : undefined}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedRows.has(row.rowIndex)}
                            disabled={hasError}
                            onChange={() => toggleRow(row.rowIndex)}
                            className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </TableCell>
                        <TableCell>{row.username}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{row.startTime}</TableCell>
                        <TableCell>{row.endTime}</TableCell>
                        <TableCell>
                          {row.type === 'WEEKEND' ? '周末' : row.type === 'HOLIDAY' ? '节假日' : '工作日'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{row.reason}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
