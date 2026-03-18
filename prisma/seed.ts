import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("开始 seeding...");

  // 清理现有数据
  await prisma.approval.deleteMany();
  await prisma.approvalFlow.deleteMany();
  await prisma.leaveBalance.deleteMany();
  await prisma.performanceReview.deleteMany();
  await prisma.leaveApplication.deleteMany();
  await prisma.overtimeApplication.deleteMany();
  await prisma.user.deleteMany();
  await prisma.position.deleteMany();
  await prisma.department.deleteMany();
  await prisma.company.deleteMany();

  console.log("清理完成，开始创建数据...");

  // 创建公司
  const company = await prisma.company.create({
    data: {
      name: "智联科技有限公司",
      code: "ZL_TECH",
      address: "北京市海淀区中关村大街1号",
      contact: "张总",
      phone: "010-12345678",
    },
  });
  console.log(`创建公司: ${company.name}`);

  // 创建部门
  const departments = await Promise.all([
    prisma.department.create({
      data: {
        name: "技术部",
        code: "TECH",
        companyId: company.id,
      },
    }),
    prisma.department.create({
      data: {
        name: "人事部",
        code: "HR",
        companyId: company.id,
      },
    }),
    prisma.department.create({
      data: {
        name: "财务部",
        code: "FINANCE",
        companyId: company.id,
      },
    }),
  ]);
  console.log(`创建 ${departments.length} 个部门`);

  // 创建岗位
  const positions = await Promise.all([
    prisma.position.create({
      data: {
        name: "高级工程师",
        salary: 25000,
        level: "P7",
      },
    }),
    prisma.position.create({
      data: {
        name: "工程师",
        salary: 18000,
        level: "P6",
      },
    }),
    prisma.position.create({
      data: {
        name: "初级工程师",
        salary: 12000,
        level: "P5",
      },
    }),
    prisma.position.create({
      data: {
        name: "人事专员",
        salary: 10000,
        level: "P4",
      },
    }),
    prisma.position.create({
      data: {
        name: "财务专员",
        salary: 11000,
        level: "P4",
      },
    }),
  ]);
  console.log(`创建 ${positions.length} 个岗位`);

  const techDept = departments.find((d) => d.code === "TECH")!;
  const hrDept = departments.find((d) => d.code === "HR")!;
  const financeDept = departments.find((d) => d.code === "FINANCE")!;

  const seniorEng = positions.find((p) => p.name === "高级工程师")!;
  const engineer = positions.find((p) => p.name === "工程师")!;
  const juniorEng = positions.find((p) => p.name === "初级工程师")!;
  const hrSpecialist = positions.find((p) => p.name === "人事专员")!;
  const financeSpecialist = positions.find((p) => p.name === "财务专员")!;

  const hashedPassword = await bcrypt.hash("password123", 10);

  // 创建管理员
  const admin = await prisma.user.create({
    data: {
      email: "admin@zltech.com",
      name: "系统管理员",
      password: hashedPassword,
      role: "ADMIN",
      phone: "13800000001",
      salary: 30000,
      level: "P8",
      departmentId: hrDept.id,
      positionId: hrSpecialist.id,
      companyId: company.id,
      startDate: new Date("2020-01-01"),
    },
  });
  console.log(`创建管理员: ${admin.name}`);

  // 创建部门经理
  const techManager = await prisma.user.create({
    data: {
      email: "tech.manager@zltech.com",
      name: "张技术",
      password: hashedPassword,
      role: "MANAGER",
      phone: "13800000002",
      salary: 28000,
      level: "P7",
      departmentId: techDept.id,
      positionId: seniorEng.id,
      companyId: company.id,
      startDate: new Date("2020-03-15"),
    },
  });

  const hrManager = await prisma.user.create({
    data: {
      email: "hr.manager@zltech.com",
      name: "李人事",
      password: hashedPassword,
      role: "MANAGER",
      phone: "13800000003",
      salary: 22000,
      level: "P6",
      departmentId: hrDept.id,
      positionId: hrSpecialist.id,
      companyId: company.id,
      startDate: new Date("2020-06-01"),
    },
  });
  console.log(`创建 2 位部门经理`);

  // 创建普通员工
  const employees = await Promise.all([
    prisma.user.create({
      data: {
        email: "wang.qiang@zltech.com",
        name: "王强",
        password: hashedPassword,
        role: "EMPLOYEE",
        phone: "13800000004",
        salary: 18000,
        level: "P6",
        departmentId: techDept.id,
        positionId: engineer.id,
        companyId: company.id,
        startDate: new Date("2022-01-10"),
      },
    }),
    prisma.user.create({
      data: {
        email: "zhao.li@zltech.com",
        name: "赵丽",
        password: hashedPassword,
        role: "EMPLOYEE",
        phone: "13800000005",
        salary: 12000,
        level: "P5",
        departmentId: techDept.id,
        positionId: juniorEng.id,
        companyId: company.id,
        startDate: new Date("2023-03-20"),
      },
    }),
    prisma.user.create({
      data: {
        email: "chen.ming@zltech.com",
        name: "陈明",
        password: hashedPassword,
        role: "EMPLOYEE",
        phone: "13800000006",
        salary: 25000,
        level: "P7",
        departmentId: techDept.id,
        positionId: seniorEng.id,
        companyId: company.id,
        startDate: new Date("2021-07-01"),
      },
    }),
    prisma.user.create({
      data: {
        email: "liu.fang@zltech.com",
        name: "刘芳",
        password: hashedPassword,
        role: "EMPLOYEE",
        phone: "13800000007",
        salary: 10000,
        level: "P4",
        departmentId: hrDept.id,
        positionId: hrSpecialist.id,
        companyId: company.id,
        startDate: new Date("2023-08-15"),
      },
    }),
    prisma.user.create({
      data: {
        email: "sun.wei@zltech.com",
        name: "孙伟",
        password: hashedPassword,
        role: "EMPLOYEE",
        phone: "13800000008",
        salary: 11000,
        level: "P4",
        departmentId: financeDept.id,
        positionId: financeSpecialist.id,
        companyId: company.id,
        startDate: new Date("2022-11-01"),
      },
    }),
    prisma.user.create({
      data: {
        email: "zhou.jie@zltech.com",
        name: "周杰",
        password: hashedPassword,
        role: "EMPLOYEE",
        phone: "13800000009",
        salary: 11000,
        level: "P4",
        departmentId: financeDept.id,
        positionId: financeSpecialist.id,
        companyId: company.id,
        startDate: new Date("2024-01-15"),
      },
    }),
  ]);
  console.log(`创建 ${employees.length} 位普通员工`);

  // 为所有用户创建假期余额
  const allUsers = [admin, techManager, hrManager, ...employees];
  const currentYear = new Date().getFullYear();

  for (const user of allUsers) {
    await prisma.leaveBalance.create({
      data: {
        userId: user.id,
        year: currentYear,
        annual: 5,
        sick: 10,
        personal: 5,
      },
    });
  }
  console.log(`为 ${allUsers.length} 位用户创建假期余额`);

  // 创建审批流程配置
  const approvalFlows = await Promise.all([
    prisma.approvalFlow.create({
      data: {
        departmentId: techDept.id,
        name: "技术部审批流程",
        types: JSON.stringify(["OVERTIME", "LEAVE", "PERFORMANCE"]),
        config: JSON.stringify([
          { step: 1, role: "MANAGER", name: "部门经理审批" },
          { step: 2, role: "ADMIN", name: "管理员审批" },
        ]),
        isActive: true,
      },
    }),
    prisma.approvalFlow.create({
      data: {
        departmentId: hrDept.id,
        name: "人事部审批流程",
        types: JSON.stringify(["OVERTIME", "LEAVE", "PERFORMANCE"]),
        config: JSON.stringify([
          { step: 1, role: "MANAGER", name: "部门经理审批" },
          { step: 2, role: "ADMIN", name: "管理员审批" },
        ]),
        isActive: true,
      },
    }),
    prisma.approvalFlow.create({
      data: {
        departmentId: financeDept.id,
        name: "财务部审批流程",
        types: JSON.stringify(["OVERTIME", "LEAVE", "PERFORMANCE"]),
        config: JSON.stringify([
          { step: 1, role: "MANAGER", name: "部门经理审批" },
          { step: 2, role: "ADMIN", name: "管理员审批" },
        ]),
        isActive: true,
      },
    }),
  ]);
  console.log(`创建 ${approvalFlows.length} 个审批流程`);

  // 创建一些测试申请数据
  const testUser = employees[0]; // 王强

  // 加班申请
  const overtimeApp = await prisma.overtimeApplication.create({
    data: {
      userId: testUser.id,
      date: new Date("2024-12-15"),
      startTime: new Date("2024-12-15T09:00:00"),
      endTime: new Date("2024-12-15T18:00:00"),
      hours: 4,
      type: "WEEKEND",
      reason: "项目紧急上线，需要周末加班完成功能开发",
      status: "PENDING",
    },
  });
  console.log(`创建加班申请: ${overtimeApp.id}`);

  // 请假申请
  const leaveApp = await prisma.leaveApplication.create({
    data: {
      userId: testUser.id,
      type: "ANNUAL",
      startDate: new Date("2024-12-20"),
      endDate: new Date("2024-12-22"),
      days: 3,
      reason: "家中有事需要处理",
      destination: "山东老家",
      status: "PENDING",
    },
  });
  console.log(`创建请假申请: ${leaveApp.id}`);

  // 绩效考核
  const perfReview = await prisma.performanceReview.create({
    data: {
      userId: testUser.id,
      period: "2024-Q4",
      quality: 4,
      efficiency: 5,
      attitude: 5,
      skill: 4,
      teamwork: 5,
      totalScore: 4.6,
      selfComment: "本季度完成了多个重要项目，团队协作良好",
      reviewerId: techManager.id,
      status: "PENDING",
    },
  });
  console.log(`创建绩效考核: ${perfReview.id}`);

  console.log("\n=== Seeding 完成! ===");
  console.log("\n测试账号信息 (密码均为: password123):");
  console.log("\n管理员:");
  console.log(`  - ${admin.email} (${admin.name})`);
  console.log("\n部门经理:");
  console.log(`  - ${techManager.email} (${techManager.name}) - 技术部`);
  console.log(`  - ${hrManager.email} (${hrManager.name}) - 人事部`);
  console.log("\n普通员工:");
  employees.forEach((emp) => {
    const dept = departments.find((d) => d.id === emp.departmentId);
    console.log(`  - ${emp.email} (${emp.name}) - ${dept?.name || "未分配"}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
