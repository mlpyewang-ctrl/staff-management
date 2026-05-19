const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

function mapType(day) {
  if (day.rat === 3) {
    return 'LEGAL_HOLIDAY'
  }
  if (day.rat === 2) {
    return 'WEEKEND_HOLIDAY'
  }
  if (day.rat === 1.5 && !day.isOffDay) {
    return 'COMPENSATORY_WORKDAY'
  }
  return 'COMPENSATORY_WORKDAY'
}

async function main() {
  const jsonPath = path.join(__dirname, 'calendar', '2026.json')

  if (!fs.existsSync(jsonPath)) {
    console.error('找不到文件: ' + jsonPath)
    process.exit(1)
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const year = data.year

  const holidays = data.days.map((day) => {
    const date = new Date(day.date)
    return {
      name: day.name,
      date: date,
      year: date.getFullYear(),
      type: mapType(day),
      rat: day.rat,
      isOffDay: day.isOffDay,
    }
  })

  // 先清理同年的旧数据，避免重复
  const deleted = await prisma.holiday.deleteMany({
    where: { year },
  })
  if (deleted.count > 0) {
    console.log('已清理 ' + deleted.count + ' 条旧记录')
  }

  console.log('准备导入 ' + holidays.length + ' 条节假日记录...')

  const result = await prisma.holiday.createMany({
    data: holidays,
  })

  console.log('✓ 成功导入 ' + result.count + ' 条记录')

  const byType = {
    LEGAL_HOLIDAY: holidays.filter((h) => h.type === 'LEGAL_HOLIDAY').length,
    WEEKEND_HOLIDAY: holidays.filter((h) => h.type === 'WEEKEND_HOLIDAY').length,
    COMPENSATORY_WORKDAY: holidays.filter((h) => h.type === 'COMPENSATORY_WORKDAY').length,
  }

  console.log('  按类型分布:')
  console.log('    法定节假日( rat=3 ): ' + byType.LEGAL_HOLIDAY + ' 天')
  console.log('    周末调休  ( rat=2 ): ' + byType.WEEKEND_HOLIDAY + ' 天')
  console.log('    调休上班  ( rat=1.5): ' + byType.COMPENSATORY_WORKDAY + ' 天')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
