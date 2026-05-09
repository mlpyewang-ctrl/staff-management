const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { username: true, name: true, role: true },
    orderBy: { createdAt: 'asc' }
  });
  console.log('Total users:', users.length);
  users.forEach(u => console.log(u.username, u.name, u.role));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
