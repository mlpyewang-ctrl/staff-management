const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  const users = await prisma.user.findMany({
    where: { role: 'EMPLOYEE' },
    select: { name: true, username: true },
    orderBy: { username: 'asc' }
  });

  const lines = ['姓名,账号'];
  users.forEach(u => lines.push(`${u.name},${u.username}`));
  fs.writeFileSync('employees_accounts.csv', lines.join('\n'), 'utf8');
  console.log('Exported', users.length, 'accounts to employees_accounts.csv');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
