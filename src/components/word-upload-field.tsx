'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseAttachment, serializeAttachment } from '@/lib/attachment'

interface WordUploadFieldProps {
  name?: string
  defaultValue?: string | null
  onChange?: (value: string) => void
}

const MAX_SIZE_MB = 2

export function WordUploadField({ name = 'attachments', defaultValue, onChange }: WordUploadFieldProps) {
  const [fileName, setFileName] = useState<string>('')
  const [jsonValue, setJsonValue] = useState<string>(defaultValue || '')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (defaultValue) {
      const parsed = parseAttachment(defaultValue)
      if (parsed) {
        setFileName(parsed.fileName)
        setJsonValue(defaultValue)
      }
    }
  }, [defaultValue])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`文件大小不能超过 ${MAX_SIZE_MB}MB`)
      return
    }

    if (!file.name.endsWith('.docx')) {
      setError('仅支持 .docx 格式的 Word 文档')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      const serialized = serializeAttachment(file.name, file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', base64)
      setFileName(file.name)
      setJsonValue(serialized)
      onChange?.(serialized)
    }
    reader.onerror = () => {
      setError('文件读取失败')
    }
    reader.readAsDataURL(file)
  }

  const handleClear = () => {
    setFileName('')
    setJsonValue('')
    setError('')
    onChange?.('')
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="word-upload">上传 Word 文档</Label>
      <Input
        id="word-upload"
        type="file"
        accept=".docx"
        onChange={handleFileChange}
      />
      <input type="hidden" name={name} value={jsonValue} />

      {fileName && (
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span>已选文件：{fileName}</span>
          <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
            清除
          </Button>
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      <p className="text-xs text-gray-500">仅支持 .docx 格式，大小不超过 {MAX_SIZE_MB}MB</p>
    </div>
  )
}
