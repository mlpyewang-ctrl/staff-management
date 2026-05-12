import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface SeedData {
  companies: Array<Record<string, unknown>>
  departments: Array<Record<string, unknown>>
  positions: Array<Record<string, unknown>>
  users: Array<Record<string, unknown>>
}

async function main() {
  const seedPath = path.join(__dirname, 'seed-data.json')

  if (!fs.existsSync(seedPath)) {
    console.error('seed-data.json not found in prisma/')
    process.exit(1)
  }

  const seedData: SeedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'))

  console.log('开始初始化数据库...')

  await prisma.company.createMany({
    data: seedData.companies as any,
    skipDuplicates: true,
  })
  console.log(`✓ 公司: ${seedData.companies.length}`)

  await prisma.department.createMany({
    data: seedData.departments as any,
    skipDuplicates: true,
  })
  console.log(`✓ 部门: ${seedData.departments.length}`)

  await prisma.position.createMany({
    data: seedData.positions as any,
    skipDuplicates: true,
  })
  console.log(`✓ 岗位: ${seedData.positions.length}`)

  await prisma.user.createMany({
    data: seedData.users as any,
    skipDuplicates: true,
  })
  console.log(`✓ 用户: ${seedData.users.length}`)

  console.log('\n数据库初始化完成')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
