'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { holidaySchema } from '@/lib/validations'

// 获取指定年份的节假日
export async function getHolidaysByYear(year: number) {
  try {
    const holidays = await prisma.holiday.findMany({
      where: { year },
      orderBy: { date: 'asc' },
    })
    return holidays
  } catch (error) {
    console.error('获取节假日失败:', error)
    return []
  }
}

// 获取指定月份的节假日
export async function getHolidaysByMonth(year: number, month: number) {
  try {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    })
    return holidays
  } catch (error) {
    console.error('获取节假日失败:', error)
    return []
  }
}

// 获取所有节假日（分页）
export async function getHolidays(year?: number) {
  try {
    const where = year ? { year } : {}
    const holidays = await prisma.holiday.findMany({
      where,
      orderBy: [{ year: 'desc' }, { date: 'asc' }],
    })
    return holidays
  } catch (error) {
    console.error('获取节假日失败:', error)
    return []
  }
}

// 添加节假日
export async function createHoliday(formData: FormData) {
  try {
    const validatedData = holidaySchema.parse({
      name: formData.get('name'),
      date: formData.get('date'),
      type: formData.get('type') || 'LEGAL_HOLIDAY',
    })

    const date = new Date(validatedData.date)
    const year = date.getFullYear()

    await prisma.holiday.create({
      data: {
        name: validatedData.name,
        date,
        year,
        type: validatedData.type,
      },
    })

    revalidatePath('/dashboard/salary')
    return { success: '节假日添加成功' }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '添加失败，请稍后重试' }
  }
}

// 删除节假日
export async function deleteHoliday(id: string) {
  try {
    if (!id) return { error: '缺少节假日 ID' }
    
    await prisma.holiday.delete({ where: { id } })
    revalidatePath('/dashboard/salary')
    return { success: '节假日已删除' }
  } catch (error) {
    if (error instanceof Error) return { error: error.message }
    return { error: '删除失败，请稍后重试' }
  }
}

// 检查某天是否是法定节假日
export async function isHoliday(date: Date): Promise<boolean> {
  try {
    const holiday = await prisma.holiday.findFirst({
      where: {
        date: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lte: new Date(date.setHours(23, 59, 59, 999)),
        },
        type: 'LEGAL_HOLIDAY',
      },
    })
    return !!holiday
  } catch (error) {
    console.error('检查节假日失败:', error)
    return false
  }
}

// 批量添加节假日（用于初始化）
export async function batchCreateHolidays(holidays: Array<{
  name: string
  date: Date
  type: string
}>) {
  try {
    const data = holidays.map(h => ({
      name: h.name,
      date: h.date,
      year: h.date.getFullYear(),
      type: h.type,
    }))

    await prisma.holiday.createMany({
      data,
      skipDuplicates: true,
    })

    return { success: `成功添加 ${holidays.length} 个节假日` }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '批量添加失败' }
  }
}
