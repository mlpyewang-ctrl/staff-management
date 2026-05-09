const iconv = require('iconv-lite');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Read new CSV
  const buf = fs.readFileSync('C:\\Users\\wjhxx\\.kimi\\sessions\\8a86885ab3a105443c2acd337263dec9\\b5c9219b-facc-4ad7-ab35-84894f6702a9\\uploads\\姓名_c64a6e.csv');
  const text = iconv.decode(buf, 'gbk');
  const newNames = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (newNames[0] === '姓名') newNames.shift();

  // Get DB users
  const dbUsers = await prisma.user.findMany({ select: { name: true, username: true } });
  const dbNames = dbUsers.map(u => u.name);

  // Compare
  const added = newNames.filter(n => !dbNames.includes(n));
  const removed = [...new Set(dbNames)].filter(n => !newNames.includes(n));

  console.log('New CSV total:', newNames.length);
  console.log('DB total users:', dbUsers.length);
  console.log('\n--- New names not in DB ---');
  added.forEach(n => console.log('+', n));
  console.log('\n--- DB names not in new CSV ---');
  removed.forEach(n => console.log('-', n));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
