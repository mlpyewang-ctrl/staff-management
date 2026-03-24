import { describe, expect, it } from 'vitest'

import { buildSalaryExcelContent, buildSalaryExportRows } from '../salary-export'

describe('buildSalaryExportRows', () => {
  it('should include all salary export fields', () => {
    const rows = buildSalaryExportRows([
      {
        id: 'salary-1',
        userId: 'user-1',
        userName: '张三',
        month: '2026-02',
        baseSalary: 12000,
        seniorityPay: 300,
        otherAdjustment: 1000,
        adjustmentNote: '清明节过节费',
        workdayOvertimeHours: 2,
        workdayOvertimePay: 200,
        weekendOvertimeHours: 3,
        weekendOvertimePay: 450,
        holidayOvertimeHours: 1,
        holidayOvertimePay: 225,
        totalOvertimePay: 875,
        compensatoryHours: 4,
        deduction: 300,
        netSalary: 13875,
        status: 'PAID',
        paidAt: new Date('2026-03-10T08:30:00.000Z'),
        createdAt: new Date('2026-03-01T01:00:00.000Z'),
        updatedAt: new Date('2026-03-12T02:00:00.000Z'),
        departmentName: '研发部',
        positionName: '工程师',
        user: {
          email: 'zhangsan@example.com',
          level: 'P6',
        },
      },
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      薪资单ID: 'salary-1',
      员工ID: 'user-1',
      姓名: '张三',
      邮箱: 'zhangsan@example.com',
      部门: '研发部',
      岗位: '工程师',
      职级: 'P6',
      月份: '2026-02',
      基本工资: 12000,
      工龄工资: 300,
      其他调整: 1000,
      调整说明: '清明节过节费',
      工作日加班时长: 2,
      工作日加班费: 200,
      周末加班时长: 3,
      周末加班费: 450,
      法定节假日加班时长: 1,
      法定节假日加班费: 225,
      计薪加班时长: 6,
      加班费合计: 875,
      调休时长: 4,
      总加班时长: 10,
      扣款: 300,
      应发工资: 13875,
      状态: '已支付',
    })

    expect(rows[0].支付时间).toBeTypeOf('string')
    expect(rows[0].创建时间).toBeTypeOf('string')
    expect(rows[0].更新时间).toBeTypeOf('string')
    expect(rows[0].小时工资).toBeGreaterThan(0)
  })
})

describe('buildSalaryExcelContent', () => {
  it('should render a table with escaped cells', () => {
    const html = buildSalaryExcelContent([
      {
        姓名: '张三<&>',
        应发工资: 8888,
      },
    ])

    expect(html).toContain('<table>')
    expect(html).toContain('张三&lt;&amp;&gt;')
    expect(html).toContain('<th')
    expect(html).toContain('<td')
  })
})
