'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TimePickerProps {
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
  className?: string
  id?: string
  name?: string
}

export function TimePicker({ value, onChange, disabled, className, id, name }: TimePickerProps) {
  const [hour, minute] = React.useMemo(() => {
    if (value && /^\d{2}:\d{2}$/.test(value)) {
      return value.split(':')
    }
    return ['', '']
  }, [value])

  const hours = React.useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')), [])
  const minutes = React.useMemo(() => ['00', '15', '30', '45'], [])

  const handleHourChange = (newHour: string) => {
    onChange?.(`${newHour}:${minute || '00'}`)
  }

  const handleMinuteChange = (newMinute: string) => {
    onChange?.(`${hour || '00'}:${newMinute}`)
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <select
        id={id}
        name={name ? `${name}_hour` : undefined}
        value={hour}
        onChange={(e) => handleHourChange(e.target.value)}
        disabled={disabled}
        className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">时</option>
        {hours.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-gray-400">:</span>
      <select
        name={name ? `${name}_minute` : undefined}
        value={minute}
        onChange={(e) => handleMinuteChange(e.target.value)}
        disabled={disabled}
        className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">分</option>
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  )
}
