import { describe, expect, it, vi } from 'vitest'

import {
  buildProfileChangeEntries,
  recordProfileChangeLogIfChanged,
} from '../profile-change-log'

describe('profile change log helpers', () => {
  it('buildProfileChangeEntries should normalize values and skip identical fields', () => {
    const entries = buildProfileChangeEntries([
      { label: '姓名', before: '张三', after: '李四' },
      { label: '学历', before: '本科', after: '本科' },
      { label: '入职日期', before: new Date('2024-01-01T00:00:00.000Z'), after: new Date('2024-01-02T00:00:00.000Z') },
    ])

    expect(entries).toEqual([
      { label: '姓名', before: '张三', after: '李四' },
      { label: '入职日期', before: '2024-01-01', after: '2024-01-02' },
    ])
  })

  it('recordProfileChangeLogIfChanged should persist change records when fields differ', async () => {
    const tx = {
      userProfileChangeLog: {
        create: vi.fn().mockResolvedValue(null),
      },
    }

    const result = await recordProfileChangeLogIfChanged({
      tx: tx as never,
      userId: 'user-1',
      actorId: 'admin-1',
      actionType: 'PROFILE_UPDATE',
      remark: '补录手机号',
      changes: [{ label: '手机号', before: null, after: '13800000000' }],
    })

    expect(result).toBe(true)
    expect(tx.userProfileChangeLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          actorId: 'admin-1',
          actionType: 'PROFILE_UPDATE',
          remark: '补录手机号',
          summary: '个人信息变更：手机号',
        }),
      })
    )
  })

  it('recordProfileChangeLogIfChanged should skip empty changes', async () => {
    const tx = {
      userProfileChangeLog: {
        create: vi.fn().mockResolvedValue(null),
      },
    }

    const result = await recordProfileChangeLogIfChanged({
      tx: tx as never,
      userId: 'user-1',
      actorId: 'admin-1',
      actionType: 'JOB_ASSIGNMENT_UPDATE',
      changes: [{ label: '岗位', before: '工程师', after: '工程师' }],
    })

    expect(result).toBe(false)
    expect(tx.userProfileChangeLog.create).not.toHaveBeenCalled()
  })
})
