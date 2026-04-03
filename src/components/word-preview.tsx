'use client'

import { useState } from 'react'
import mammoth from 'mammoth'
import { Button } from '@/components/ui/button'
import type { AttachmentData } from '@/lib/attachment'

interface WordPreviewProps {
  attachment: AttachmentData
}

export function WordPreview({ attachment }: WordPreviewProps) {
  const [html, setHtml] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [expanded, setExpanded] = useState(false)

  const handlePreview = async () => {
    if (expanded) {
      setExpanded(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const byteCharacters = atob(attachment.data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)

      const result = await mammoth.convertToHtml({ arrayBuffer: byteArray.buffer })
      setHtml(result.value)
      setExpanded(true)
    } catch (err) {
      setError('文档预览失败，请检查文件格式')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handlePreview} disabled={loading}>
          {loading ? '加载中...' : expanded ? '收起预览' : '预览 Word 文档'}
        </Button>
        <span className="text-sm text-gray-600">{attachment.fileName}</span>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {expanded && html && (
        <div
          className="max-h-96 overflow-auto rounded-md border border-gray-200 bg-white p-4 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  )
}
