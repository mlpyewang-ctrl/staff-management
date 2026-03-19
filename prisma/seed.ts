import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// 法定节假日数据 2024-2026
const holidaysData = [
  // 2024年
  { name: "元旦", startDate: "2024-01-01", days: 1 },
  { name: "春节", startDate: "2024-02-10", days: 8 },
  { name: "清明节", startDate: "2024-04-04", days: 3 },
  { name: "劳动节", startDate: "2024-05-01", days: 5 },
  { name: "端午节", startDate: "2024-06-10", days: 3 },
  { name: "中秋节", startDate: "2024-09-15", days: 3 },
  { name: "国庆节", startDate: "2024-10-01", days: 7 },
  // 2025年
  { name: "元旦", startDate: "2025-01-01", days: 1 },
  { name: "春节", startDate: "2025-01-28", days: 8 },
  { name: "清明节", startDate: "2025-04-04", days: 3 },
  { name: "劳动节", startDate: "2025-05-01", days: 5 },
  { name: "端午节", startDate: "2025-05-31", days: 3 },
  { name: "中秋节", startDate: "2025-10-06", days: 1 },
  { name: "国庆节", startDate: "2025-10-01", days: 7 },
  // 2026年
  { name: "元旦", startDate: "2026-01-01", days: 1 },
  { name: "春节", startDate: "2026-02-17", days: 8 },
  { name: "清明节", startDate: "2026-04-05", days: 3 },
  { name: "劳动节", startDate: "2026-05-01", days: 5 },
  { name: "端午节", startDate: "2026-05-31", days: 3 },
  { name: "中秋节", startDate: "2026-09-25", days: 1 },
  { name: "国庆节", startDate: "2026-10-01", days: 7 },
];

async function main() {
  console.log("开始 seeding...");

  // 清理现有数据
  await prisma.overtimeSettlement.deleteMany();
  await prisma.salaryRecord.deleteMany();
  await prisma.holiday.deleteMany();
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

  // ========== 新增：法定节假日数据 ==========
  console.log("\n开始创建法定节假日数据...");
  let holidayCount = 0;
  for (const holiday of holidaysData) {
    const startDate = new Date(holiday.startDate);
    const year = startDate.getFullYear();
    for (let i = 0; i < holiday.days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      await prisma.holiday.create({
        data: {
          name: holiday.name,
          date: date,
          year: year,
          type: "LEGAL_HOLIDAY",
        },
      });
      holidayCount++;
    }
  }
  console.log(`创建 ${holidayCount} 天法定节假日记录`);

  // ========== 新增：更多加班申请测试数据 ==========
  console.log("\n创建更多加班申请测试数据...");
  
  // 王强的加班数据 - 测试场景：总时长 < 36h，全部计薪
  const wangQiang = employees[0];
  const overtimeData1 = [
    { date: "2026-02-09", startTime: "18:00", endTime: "21:00", type: "WORKDAY", hours: 3, status: "APPROVED" },
    { date: "2026-02-10", startTime: "18:00", endTime: "22:00", type: "WORKDAY", hours: 4, status: "APPROVED" },
    { date: "2026-02-14", startTime: "09:00", endTime: "18:00", type: "WEEKEND", hours: 8, status: "APPROVED" },
    { date: "2026-02-15", startTime: "09:00", endTime: "13:00", type: "WEEKEND", hours: 4, status: "APPROVED" },
    // 2月总计 19 小时
  ];
  
  for (const ot of overtimeData1) {
    await prisma.overtimeApplication.create({
      data: {
        userId: wangQiang.id,
        date: new Date(ot.date),
        startTime: new Date(`${ot.date}T${ot.startTime}:00`),
        endTime: new Date(`${ot.date}T${ot.endTime}:00`),
        hours: ot.hours,
        type: ot.type,
        reason: "项目开发需要",
        status: ot.status,
        approverId: techManager.id,
        approvedAt: new Date(ot.date),
      },
    });
  }

  // 陈明的加班数据 - 测试场景：总时长 > 36h，部分转调休
  const chenMing = employees[2];
  const overtimeData2 = [
    { date: "2026-02-09", startTime: "18:00", endTime: "22:00", type: "WORKDAY", hours: 4, status: "APPROVED" },
    { date: "2026-02-10", startTime: "18:00", endTime: "22:00", type: "WORKDAY", hours: 4, status: "APPROVED" },
    { date: "2026-02-11", startTime: "18:00", endTime: "22:00", type: "WORKDAY", hours: 4, status: "APPROVED" },
    { date: "2026-02-12", startTime: "18:00", endTime: "22:00", type: "WORKDAY", hours: 4, status: "APPROVED" },
    { date: "2026-02-14", startTime: "09:00", endTime: "18:00", type: "WEEKEND", hours: 8, status: "APPROVED" },
    { date: "2026-02-15", startTime: "09:00", endTime: "18:00", type: "WEEKEND", hours: 8, status: "APPROVED" },
    { date: "2026-02-16", startTime: "09:00", endTime: "18:00", type: "WEEKEND", hours: 8, status: "APPROVED" },
    { date: "2026-02-17", startTime: "09:00", endTime: "13:00", type: "HOLIDAY", hours: 4, status: "APPROVED" }, // 春节加班
    // 2月总计 44 小时，超 36h，8h 转调休
  ];
  
  for (const ot of overtimeData2) {
    await prisma.overtimeApplication.create({
      data: {
        userId: chenMing.id,
        date: new Date(ot.date),
        startTime: new Date(`${ot.date}T${ot.startTime}:00`),
        endTime: new Date(`${ot.date}T${ot.endTime}:00`),
        hours: ot.hours,
        type: ot.type,
        reason: "紧急项目支持",
        status: ot.status,
        approverId: techManager.id,
        approvedAt: new Date(ot.date),
      },
    });
  }

  // 赵丽的加班数据 - 测试场景：混合类型，按优先级转调休
  const zhaoLi = employees[1];
  const overtimeData3 = [
    { date: "2026-02-09", startTime: "18:00", endTime: "21:00", type: "WORKDAY", hours: 3, status: "APPROVED" },
    { date: "2026-02-10", startTime: "18:00", endTime: "21:00", type: "WORKDAY", hours: 3, status: "APPROVED" },
    { date: "2026-02-11", startTime: "18:00", endTime: "21:00", type: "WORKDAY", hours: 3, status: "APPROVED" },
    { date: "2026-02-12", startTime: "18:00", endTime: "21:00", type: "WORKDAY", hours: 3, status: "APPROVED" },
    { date: "2026-02-13", startTime: "18:00", endTime: "21:00", type: "WORKDAY", hours: 3, status: "APPROVED" },
    { date: "2026-02-14", startTime: "09:00", endTime: "18:00", type: "WEEKEND", hours: 8, status: "APPROVED" },
    { date: "2026-02-15", startTime: "09:00", endTime: "18:00", type: "WEEKEND", hours: 8, status: "APPROVED" },
    { date: "2026-02-21", startTime: "09:00", endTime: "18:00", type: "WEEKEND", hours: 8, status: "APPROVED" },
    { date: "2026-02-17", startTime: "09:00", endTime: "18:00", type: "HOLIDAY", hours: 8, status: "APPROVED" }, // 春节加班
    // 2月总计 47 小时，超 36h，11h 转调休（优先节假日>周末）
  ];
  
  for (const ot of overtimeData3) {
    await prisma.overtimeApplication.create({
      data: {
        userId: zhaoLi.id,
        date: new Date(ot.date),
        startTime: new Date(`${ot.date}T${ot.startTime}:00`),
        endTime: new Date(`${ot.date}T${ot.endTime}:00`),
        hours: ot.hours,
        type: ot.type,
        reason: "系统维护和开发",
        status: ot.status,
        approverId: techManager.id,
        approvedAt: new Date(ot.date),
      },
    });
  }

  // 添加一些待审批的加班申请
  await prisma.overtimeApplication.create({
    data: {
      userId: wangQiang.id,
      date: new Date("2026-02-23"),
      startTime: new Date("2026-02-23T18:00:00"),
      endTime: new Date("2026-02-23T21:00:00"),
      hours: 3,
      type: "WORKDAY",
      reason: "临时需求处理",
      status: "PENDING",
    },
  });

  console.log(`创建测试加班申请数据完成`);

  // ========== 新增：测试薪资记录 ==========
  console.log("\n创建测试薪资记录...");
  
  // 为王强创建 2026-01 月薪资记录（已确认状态）
  await prisma.salaryRecord.create({
    data: {
      userId: wangQiang.id,
      month: "2026-01",
      baseSalary: 18000,
      workdayOvertimeHours: 8,
      workdayOvertimePay: 1241.38,
      weekendOvertimeHours: 8,
      weekendOvertimePay: 1655.17,
      holidayOvertimeHours: 0,
      holidayOvertimePay: 0,
      totalOvertimePay: 2896.55,
      compensatoryHours: 0,
      deduction: 0,
      netSalary: 20896.55,
      status: "CONFIRMED",
    },
  });

  // 为陈明创建 2026-01 月薪资记录（已支付状态），有调休
  await prisma.salaryRecord.create({
    data: {
      userId: chenMing.id,
      month: "2026-01",
      baseSalary: 25000,
      // 说明：这里的 *OvertimeHours 为“计薪小时数”
      // 陈明当月总加班 16+24+8=48h，超过36h的 12h（优先从工作日）转调休，不计费
      workdayOvertimeHours: 4,
      workdayOvertimePay: 862.07,
      weekendOvertimeHours: 24,
      weekendOvertimePay: 6896.55,
      holidayOvertimeHours: 8,
      holidayOvertimePay: 3448.28,
      totalOvertimePay: 11206.9,
      compensatoryHours: 12, // 超过36h转调休
      deduction: 0,
      netSalary: 36206.9,
      status: "PAID",
      paidAt: new Date("2026-02-15"),
    },
  });

  // 为赵丽创建 2026-01 月薪资记录（草稿状态）
  await prisma.salaryRecord.create({
    data: {
      userId: zhaoLi.id,
      month: "2026-01",
      baseSalary: 12000,
      workdayOvertimeHours: 12,
      workdayOvertimePay: 1034.48,
      weekendOvertimeHours: 16,
      weekendOvertimePay: 2758.62,
      holidayOvertimeHours: 0,
      holidayOvertimePay: 0,
      totalOvertimePay: 3793.10,
      compensatoryHours: 0,
      deduction: 0,
      netSalary: 15793.10,
      status: "DRAFT",
    },
  });

  console.log(`创建测试薪资记录完成`);

  // ========== 新增：调休余额数据 ==========
  console.log("\n更新调休余额数据...");
  
  // 为陈明添加调休余额（从上月结转）
  await prisma.leaveBalance.update({
    where: { userId: chenMing.id },
    data: {
      compensatory: 12,
    },
  });

  // 为赵丽添加调休余额
  await prisma.leaveBalance.update({
    where: { userId: zhaoLi.id },
    data: {
      compensatory: 8,
    },
  });

  console.log(`调休余额数据更新完成`);

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
  console.log("\n测试数据说明:");
  console.log(`  - 法定节假日: ${holidayCount} 天 (2024-2026年)`);
  console.log(`  - 加班申请: 包含不同类型、不同状态的测试数据`);
  console.log(`  - 薪资记录: 包含草稿/已确认/已支付三种状态`);
  console.log(`  - 调休余额: 部分员工有调休余额`);
  console.log("\n测试场景:");
  console.log(`  1. 王强: 加班 < 36h，全部计薪`);
  console.log(`  2. 陈明: 加班 > 36h，部分转调休（有调休余额 12h）`);
  console.log(`  3. 赵丽: 混合加班类型，按优先级转调休（有调休余额 8h）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
