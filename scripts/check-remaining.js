const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { username: true, name: true },
    orderBy: { createdAt: 'asc' }
  });
  console.log('Remaining users:', users.length);
  users.forEach(u => console.log(u.username, u.name));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
