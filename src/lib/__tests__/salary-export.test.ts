import { describe, expect, it } from 'vitest'

import { buildSalaryExcelContent, buildSalaryExportRows } from '../salary-export'

describe('buildSalaryExportRows', () => {
  it('should include all 12 salary export fields', () => {
    const rows = buildSalaryExportRows([
      {
        id: 'salary-1',
        userId: 'user-1',
        userName: '张三',
        month: '2026-02',
        baseSalary: 12500,
        seniorityPay: 300,
        otherAdjustment: 200,
        classLeaderAllowance: 500,
        dormHeadAllowance: 300,
        electricityAllowance: 100,
        supplementalPay: 0,
        deductionAdjustment: 0,
        adjustmentNote: null,
        workdayOvertimeHours: 2,
        workdayOvertimePay: 200,
        weekendOvertimeHours: 3,
        weekendOvertimePay: 450,
        holidayOvertimeHours: 1,
        holidayOvertimePay: 225,
        totalOvertimePay: 875,
        compensatoryHours: 4,
        deduction: 300,
        netSalary: 14175,
        status: 'PAID',
        paidAt: new Date('2026-03-10T08:30:00.000Z'),
        createdAt: new Date('2026-03-01T01:00:00.000Z'),
        updatedAt: new Date('2026-03-12T02:00:00.000Z'),
        departmentName: '研发部',
        positionName: '工程师',
        user: {
          username: 'zhangsan@example.com',
          level: 'P6',
          educationSalary: 500,
        },
      },
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      姓名: '张三',
      基础工资: 12000,
      工龄工资: 300,
      学历工资: 500,
      班长补助: 500,
      宿舍负责人补助: 300,
      电费补助: 100,
      加班费: 875,
      补发工资: 0,
      补扣工资: 0,
      请假: 300,
      小计: 14175,
    })
  })
})

describe('buildSalaryExcelContent', () => {
  it('should render a table with escaped cells', () => {
    const html = buildSalaryExcelContent([
      {
        姓名: '张三<&>',
        小计: 8888,
      },
    ])

    expect(html).toContain('<table>')
    expect(html).toContain('张三&lt;&amp;&gt;')
    expect(html).toContain('<th')
    expect(html).toContain('<td')
  })
})
