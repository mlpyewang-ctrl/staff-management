const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  // 检查是否已有管理员
  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  })

  if (existingAdmin) {
    console.log('管理员账号已存在')
    return
  }

  // 创建管理员
  const hashedPassword = await bcrypt.hash('admin123', 10)

  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: hashedPassword,
      name: '系统管理员',
      role: 'ADMIN',
    },
  })

  console.log('管理员账号已创建:')
  console.log('  邮箱：admin@example.com')
  console.log('  密码：admin123')
  console.log('  ID:', admin.id)

  // 创建测试员工
  const employeePassword = await bcrypt.hash('employee123', 10)
  const employee = await prisma.user.create({
    data: {
      email: 'employee@example.com',
      password: employeePassword,
      name: '测试员工',
      role: 'EMPLOYEE',
    },
  })

  // 创建员工的假期余额
  await prisma.leaveBalance.create({
    data: {
      userId: employee.id,
      year: new Date().getFullYear(),
    },
  })

  console.log('\n测试员工账号已创建:')
  console.log('  邮箱：employee@example.com')
  console.log('  密码：employee123')

  // 创建测试主管
  const managerPassword = await bcrypt.hash('manager123', 10)
  await prisma.user.create({
    data: {
      email: 'manager@example.com',
      password: managerPassword,
      name: '测试主管',
      role: 'MANAGER',
    },
  })

  console.log('\n测试主管账号已创建:')
  console.log('  邮箱：manager@example.com')
  console.log('  密码：manager123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
