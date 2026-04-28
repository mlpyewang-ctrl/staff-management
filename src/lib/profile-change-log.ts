import type { Prisma } from '@prisma/client'

import { formatDateInputValue } from '@/lib/seniority'

type TransactionClient = Prisma.TransactionClient

export type ProfileChangeActionType = 'PROFILE_UPDATE' | 'JOB_ASSIGNMENT_UPDATE'

export interface ProfileChangeInput {
  label: string
  before: unknown
  after: unknown
}

export interface ProfileChangeEntry {
  label: string
  before: string
  after: string
}

interface RecordProfileChangeLogParams {
  tx: TransactionClient
  userId: string
  actorId: string
  actionType: ProfileChangeActionType
  changes: ProfileChangeInput[]
  remark?: string | null
}

function formatProfileChangeValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '未填写'
  }

  if (value instanceof Date) {
    return formatDateInputValue(value) || '未填写'
  }

  return String(value).trim() || '未填写'
}

function buildProfileChangeSummary(actionType: ProfileChangeActionType, changes: ProfileChangeEntry[]) {
  const labels = changes.map((change) => change.label).join('、')

  if (actionType === 'PROFILE_UPDATE') {
    return `个人信息变更：${labels}`
  }

  return `任职信息变更：${labels}`
}

export function buildProfileChangeEntries(changes: ProfileChangeInput[]) {
  return changes
    .map<ProfileChangeEntry>((change) => ({
      label: change.label,
      before: formatProfileChangeValue(change.before),
      after: formatProfileChangeValue(change.after),
    }))
    .filter((change) => change.before !== change.after)
}

export async function recordProfileChangeLogIfChanged({
  tx,
  userId,
  actorId,
  actionType,
  changes,
  remark,
}: RecordProfileChangeLogParams) {
  const changeEntries = buildProfileChangeEntries(changes)

  if (!changeEntries.length) {
    return false
  }

  await tx.userProfileChangeLog.create({
    data: {
      userId,
      actorId,
      actionType,
      summary: buildProfileChangeSummary(actionType, changeEntries),
      remark: remark?.trim() || null,
      changes: changeEntries as unknown as Prisma.InputJsonValue,
    },
  })

  return true
}
