'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Calendar } from './calendar'

export interface DatePickerProps {
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
  className?: string
  id?: string
  name?: string
  placeholder?: string
}

export function DatePicker({
  value,
  onChange,
  disabled,
  className,
  id,
  name,
  placeholder = '选择日期',
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [viewDate, setViewDate] = React.useState(() =>
    value ? new Date(value) : new Date()
  )
  const containerRef = React.useRef<HTMLDivElement>(null)

  // 当 value 变化时，同步 viewDate（打开时显示选中的月份）
  React.useEffect(() => {
    if (value) {
      setViewDate(new Date(value))
    }
  }, [value])

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const displayText = React.useMemo(() => {
    if (!value) return placeholder
    return value
  }, [value, placeholder])

  const handleDateSelect = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    onChange?.(`${year}-${month}-${day}`)
    setOpen(false)
  }

  const handleMonthChange = (year: number, month: number) => {
    setViewDate(new Date(year, month - 1, 1))
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        id={id}
        type="button"
        name={name}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          !value && 'text-gray-400'
        )}
      >
        <span>{displayText}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white shadow-lg">
          <Calendar
            year={viewDate.getFullYear()}
            month={viewDate.getMonth() + 1}
            onDateSelect={handleDateSelect}
            onMonthChange={handleMonthChange}
          />
        </div>
      )}
    </div>
  )
}
