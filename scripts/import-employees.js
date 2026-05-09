const fs = require('fs');
const iconv = require('iconv-lite');
const pinyin = require('pinyin');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function toPinyinAccount(name) {
  const py = pinyin.pinyin(name, { style: 0 });
  return py.flat().join('').toLowerCase();
}

async function main() {
  const csvPath = process.argv[2] || 'C:\\Users\\wjhxx\\.kimi\\sessions\\8a86885ab3a105443c2acd337263dec9\\b5c9219b-facc-4ad7-ab35-84894f6702a9\\uploads\\姓名_1fd2ca.csv';
  const buf = fs.readFileSync(csvPath);
  const text = iconv.decode(buf, 'gbk');
  const names = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Remove header if it's "姓名"
  const startIndex = names[0] === '姓名' ? 1 : 0;
  const employeeNames = names.slice(startIndex);

  // Get existing usernames to avoid conflicts
  const existingUsers = await prisma.user.findMany({ select: { username: true, name: true } });
  const existingUsernames = new Set(existingUsers.map(u => u.username));

  console.log('Existing users:', existingUsers.length);

  const usernameCounts = {};
  const usersToCreate = [];

  for (const name of employeeNames) {
    let base = toPinyinAccount(name);
    let username = base;
    let count = 1;

    while (existingUsernames.has(username) || usernameCounts[username]) {
      username = base + count;
      count++;
    }

    usernameCounts[username] = true;

    const password = await bcrypt.hash('123456', 10);
    usersToCreate.push({
      username,
      name,
      password,
      role: 'EMPLOYEE',
    });
  }

  console.log('Users to create:', usersToCreate.length);

  // Show preview
  console.log('\nPreview (first 20):');
  usersToCreate.slice(0, 20).forEach(u => console.log(`${u.name} -> ${u.username}`));

  if (usersToCreate.length > 20) {
    console.log(`... and ${usersToCreate.length - 20} more`);
  }

  // Insert into database
  const result = await prisma.user.createMany({
    data: usersToCreate,
    skipDuplicates: true,
  });

  console.log(`\nCreated ${result.count} users.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
