const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const names = ['何向东','华湘军','黄天敏','黄祥中','廖钦茂','林雄柱','卢咏旋','邵国华','唐健亮','王省军','吴增宝','谢日旺','毕海怡','叶志崇','刘盼君','李宇','赵维','曾兰茜','明强忠'];
  const users = await prisma.user.findMany({
    where: { name: { in: names } },
    select: { name: true, username: true },
    orderBy: { username: 'asc' }
  });
  users.forEach(u => console.log(u.name, '->', u.username));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
