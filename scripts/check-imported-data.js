const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const importedNames = ['王睿灏','陈伯平','易记永','闫敬中','罗浩','张怡','林杏芸','谭小钢','卢淑慧','张贵平','张慧慧','林荣强','王靖晖','余伟佳','蔡勇杰','郭淑平','何向东','华湘军','黄天敏','黄祥中','廖钦茂','林雄柱','卢咏旋','邵国华','唐健亮','王省军','吴增宝','谢日旺','毕海怡','叶志崇','刘盼君','李宇','赵维','曾兰茜','明强忠','林超华','张旭峰','王政杰','史礼旭','谢煌鹏','陈义','严滔','王巧敏','李宝丽','罗婷婷','曾柳清','罗丽娟','萧柳琪','高冰容','胡颖','卜小春','吴碧霞','江琳燕','刘虹庆','罗燕','郭似蕊','曾群英','丘绿薇','王玉婷','彭润玉','陈雪绸','黄丹华','彭佳怡','黄星','杨晓庆','何裕婷','李洁露','周舒诺','赵梓伊','李梦田','陈莹','吴维真','黄健','林冲','古亮辉','张义','王木权','成会明','王杰','黄北金','马小元','钟远飞','温慧萍','魏小青','谢晋坤','刘小兰','尹丽丽','陈妃汝','刘秋萍','吴静燕','石荣健','霍香秀','陈少华','陈颖琦','林晓婷','胡兴冉','娄越','沈文婷','刘锦睿','彭若木','陈实','廖鑫','郭晓慧','徐博翰','林青','李晓军','杨佳怡'];

  const users = await prisma.user.findMany({
    where: { name: { in: importedNames } },
    select: {
      id: true, name: true, username: true,
      _count: {
        select: {
          overtimeApplications: true,
          leaveApplications: true,
          performanceReviews: true,
          approvals: true,
          salaryRecords: true,
          overtimeSettlements: true,
          otherApplications: true,
          resumeVersions: true,
          partyInfoVersions: true,
          profileChangeLogs: true,
        }
      }
    }
  });

  let hasData = false;
  for (const u of users) {
    const total = Object.values(u._count).reduce((a, b) => a + b, 0);
    if (total > 0) {
      console.log(u.name, u.username, 'has data:', u._count);
      hasData = true;
    }
  }

  if (!hasData) {
    console.log('All imported users have NO business data. Safe to delete and re-import.');
  }
  console.log('Total imported users found:', users.length);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
