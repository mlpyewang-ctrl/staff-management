'use client'

import { useEffect, useState } from 'react'
import { getHolidaysByMonth } from '@/server/actions/holiday'

interface Holiday {
  id: string
  name: string
  date: Date
  type: string
}

interface CalendarProps {
  year?: number
  month?: number
  onDateSelect?: (date: Date) => void
}

export function Calendar({ year, month, onDateSelect }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [holidays, setHolidays] = useState<Holiday[]>([])

  const displayYear = year ?? currentDate.getFullYear()
  const displayMonth = month ?? currentDate.getMonth() + 1

  useEffect(() => {
    const loadHolidays = async () => {
      const data = await getHolidaysByMonth(displayYear, displayMonth)
      setHolidays(data)
    }
    loadHolidays()
  }, [displayYear, displayMonth])

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month - 1, 1).getDay()
  }

  const isHoliday = (day: number) => {
    const date = new Date(displayYear, displayMonth - 1, day)
    return holidays.find((h) => {
      const hDate = new Date(h.date)
      return hDate.getFullYear() === date.getFullYear() &&
             hDate.getMonth() === date.getMonth() &&
             hDate.getDate() === date.getDate()
    })
  }

  const isToday = (day: number) => {
    const today = new Date()
    return today.getFullYear() === displayYear &&
           today.getMonth() === displayMonth - 1 &&
           today.getDate() === day
  }

  const isWeekend = (day: number) => {
    const date = new Date(displayYear, displayMonth - 1, day)
    const dayOfWeek = date.getDay()
    return dayOfWeek === 0 || dayOfWeek === 6
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(displayYear, displayMonth - 2, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(displayYear, displayMonth, 1))
  }

  const daysInMonth = getDaysInMonth(displayYear, displayMonth)
  const firstDay = getFirstDayOfMonth(displayYear, displayMonth)
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']

  const days = []
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-10" />)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const holiday = isHoliday(day)
    const todayClass = isToday(day) ? 'bg-blue-500 text-white rounded-full' : ''
    const weekendClass = isWeekend(day) && !holiday ? 'text-red-400' : ''
    const holidayClass = holiday ? 'bg-red-100 text-red-600 font-medium' : ''

    days.push(
      <div
        key={day}
        className={`h-10 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 rounded ${todayClass} ${weekendClass} ${holidayClass}`}
        onClick={() => onDateSelect?.(new Date(displayYear, displayMonth - 1, day))}
        title={holiday?.name}
      >
        <span className="text-sm">{day}</span>
        {holiday && (
          <span className="text-xs text-red-500 truncate w-full text-center">{holiday.name}</span>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-gray-100 rounded"
        >
          &lt;
        </button>
        <h3 className="text-lg font-semibold">
          {displayYear}年{displayMonth}月
        </h3>
        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-100 rounded"
        >
          &gt;
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <div key={day} className="h-8 flex items-center justify-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
        {days}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-100 rounded"></div>
          <span>法定节假日</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span>今天</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 border border-red-400 rounded"></div>
          <span>周末</span>
        </div>
      </div>
    </div>
  )
}
