const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { username: true, name: true, createdAt: true }
  });
  users.forEach(u => console.log(u.username, u.name));

  const total = await prisma.user.count();
  console.log('\nTotal users:', total);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
