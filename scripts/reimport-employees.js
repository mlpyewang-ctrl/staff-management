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
  const csvPath = 'C:\\Users\\wjhxx\\.kimi\\sessions\\8a86885ab3a105443c2acd337263dec9\\b5c9219b-facc-4ad7-ab35-84894f6702a9\\uploads\\姓名_c64a6e.csv';
  const buf = fs.readFileSync(csvPath);
  const text = iconv.decode(buf, 'gbk');
  const names = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const startIndex = names[0] === '姓名' ? 1 : 0;
  const employeeNames = names.slice(startIndex);

  // Get existing users
  const existingUsers = await prisma.user.findMany({ select: { username: true, name: true, id: true } });
  const existingUsernames = new Set(existingUsers.map(u => u.username));

  // Identify users to delete (previous import batch, not original 10)
  const originalUsernames = ['admin', 'zhangjs', 'lirsh', 'wangkq', 'sunw', 'zhouj', 'liuf', 'zhaol', 'chenm', 'wangq'];
  const usersToDelete = existingUsers.filter(u => !originalUsernames.includes(u.username));

  console.log('Existing users:', existingUsers.length);
  console.log('Users to delete (previous import):', usersToDelete.length);

  if (usersToDelete.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: usersToDelete.map(u => u.id) } }
    });
    console.log('Deleted previous import users.');
  }

  // Rebuild existing usernames set after deletion
  const remainingUsers = await prisma.user.findMany({ select: { username: true } });
  const currentUsernames = new Set(remainingUsers.map(u => u.username));

  const usernameCounts = {};
  const usersToCreate = [];

  for (const name of employeeNames) {
    let base = toPinyinAccount(name);
    let username = base;
    let count = 1;

    while (currentUsernames.has(username) || usernameCounts[username]) {
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

  console.log('\nPreview (first 20):');
  usersToCreate.slice(0, 20).forEach(u => console.log(`${u.name} -> ${u.username}`));

  if (usersToCreate.length > 20) {
    console.log(`... and ${usersToCreate.length - 20} more`);
  }

  const result = await prisma.user.createMany({
    data: usersToCreate,
    skipDuplicates: true,
  });

  console.log(`\nCreated ${result.count} users.`);

  // Export accounts
  const allUsers = await prisma.user.findMany({
    where: { role: 'EMPLOYEE' },
    select: { name: true, username: true },
    orderBy: { username: 'asc' }
  });

  const lines = ['姓名,账号'];
  allUsers.forEach(u => lines.push(`${u.name},${u.username}`));
  fs.writeFileSync('employees_accounts.csv', lines.join('\n'), 'utf8');
  console.log('Exported', allUsers.length, 'accounts to employees_accounts.csv');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
