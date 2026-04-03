'use client'

import { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'

// 动态导入 react-quill 以避免 SSR 问题
const ReactQuill = dynamic(
  async () => {
    const { default: RQ } = await import('react-quill')
    return RQ
  },
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
    ),
  }
)

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  height?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = '请输入内容...',
  className,
  height = '300px',
}: RichTextEditorProps) {
  const [mounted, setMounted] = useState(false)
  const quillContainerRef = useRef<HTMLDivElement>(null)
  const quillInstanceRef = useRef<unknown>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 加载 Quill 样式
  useEffect(() => {
    if (!mounted) return

    if (!document.querySelector('link[href*="quill.snow"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://cdn.jsdelivr.net/npm/react-quill@2.0.0/dist/quill.snow.css'
      document.head.appendChild(link)
    }
  }, [mounted])

  // 自定义样式覆盖
  useEffect(() => {
    if (!mounted) return

    const style = document.createElement('style')
    style.innerHTML = `
      .ql-toolbar {
        border-color: #e2e8f0 !important;
        border-top-left-radius: 0.5rem;
        border-top-right-radius: 0.5rem;
        background-color: #f8fafc;
      }
      .ql-container {
        border-color: #e2e8f0 !important;
        border-bottom-left-radius: 0.5rem;
        border-bottom-right-radius: 0.5rem;
        font-size: 14px;
      }
      .ql-editor {
        min-height: ${height};
      }
      .ql-editor table {
        width: 100%;
        border-collapse: collapse;
        margin: 1em 0;
        border: 1px solid #cbd5e1;
      }
      .ql-editor table tr {
        border-bottom: 1px solid #cbd5e1;
      }
      .ql-editor table tr:last-child {
        border-bottom: none;
      }
      .ql-editor table td,
      .ql-editor table th {
        border: 1px solid #cbd5e1;
        padding: 8px 12px;
        min-width: 50px;
      }
      .ql-editor table th {
        background-color: #f1f5f9;
        font-weight: 600;
      }
      .ql-editor table td {
        background-color: #fff;
      }
      /* 确保空单元格有高度 */
      .ql-editor table td:empty::before {
        content: ' ';
        display: inline-block;
        width: 1px;
      }
    `
    document.head.appendChild(style)
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style)
      }
    }
  }, [height, mounted])

  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ color: [] }, { background: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ indent: '-1' }, { indent: '+1' }],
        [{ align: [] }],
        ['link'],
        ['clean'],
      ],
      clipboard: {
        matchVisual: false,
      },
    }),
    []
  )

  const formats = useMemo(
    () => [
      'header',
      'bold',
      'italic',
      'underline',
      'strike',
      'color',
      'background',
      'list',
      'bullet',
      'indent',
      'align',
      'link',
    ],
    []
  )

  // 获取 Quill 编辑器实例的通用函数
  const getQuillEditor = useCallback(() => {
    // 优先使用缓存的实例
    if (quillInstanceRef.current) {
      return quillInstanceRef.current as {
        getSelection: (focus?: boolean) => { index: number; length: number } | null
        clipboard: { dangerouslyPasteHTML: (index: number, html: string) => void }
        insertEmbed: (index: number, type: string, value: string) => void
        setSelection: (index: number, length: number) => void
        getLength: () => number
        focus: () => void
        root: HTMLElement
      }
    }
    
    // 从 DOM 获取
    const container = quillContainerRef.current?.querySelector('.ql-container')
    if (container) {
      const quill = (container as HTMLElement & { __quill?: unknown }).__quill
      if (quill) {
        quillInstanceRef.current = quill
        return quill as {
          getSelection: (focus?: boolean) => { index: number; length: number } | null
          clipboard: { dangerouslyPasteHTML: (index: number, html: string) => void }
          insertEmbed: (index: number, type: string, value: string) => void
          setSelection: (index: number, length: number) => void
          getLength: () => number
          focus: () => void
          root: HTMLElement
        }
      }
    }
    return null
  }, [])

  // 表格插入按钮处理 - 使用 Quill API
  const insertTable = useCallback(() => {
    const rowsStr = prompt('请输入行数 (1-20):', '3')
    if (!rowsStr) return
    
    const colsStr = prompt('请输入列数 (1-10):', '3')
    if (!colsStr) return

    const rows = parseInt(rowsStr, 10)
    const cols = parseInt(colsStr, 10)

    if (isNaN(rows) || isNaN(cols) || rows <= 0 || cols <= 0 || rows > 20 || cols > 10) {
      alert('请输入有效的行数和列数（1-20行，1-10列）')
      return
    }

    // 构建表格 HTML
    let tableHtml = '<table style="width:100%;border-collapse:collapse;margin:1em 0;border:1px solid #ccc;">'
    for (let i = 0; i < rows; i++) {
      tableHtml += '<tr>'
      for (let j = 0; j < cols; j++) {
        tableHtml += '<td style="border:1px solid #ccc;padding:8px;">&nbsp;</td>'
      }
      tableHtml += '</tr>'
    }
    tableHtml += '</table><p><br/></p>'

    const quill = getQuillEditor()
    
    if (quill) {
      // 获取当前光标位置
      const selection = quill.getSelection(true)
      const index = selection ? selection.index : quill.getLength()
      
      // 插入 HTML
      quill.clipboard.dangerouslyPasteHTML(index, tableHtml)
      
      // 移动光标到表格后
      quill.setSelection(index + rows * cols + 1, 0)
      quill.focus()
    } else {
      // 备用：直接修改 value
      const newValue = value ? `${value}${tableHtml}` : tableHtml
      onChange(newValue)
    }
  }, [getQuillEditor, onChange, value])

  if (!mounted) {
    return (
      <div className="h-[300px] animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
    )
  }

  return (
    <div className={cn('rich-text-editor space-y-2', className)} ref={quillContainerRef}>
      {/* 自定义表格按钮 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={insertTable}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
        >
          ⊞ 插入表格
        </button>
        <span className="text-xs text-slate-400">也可从 Word/Excel 直接粘贴表格</span>
      </div>

      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
      />
    </div>
  )
}
