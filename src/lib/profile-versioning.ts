import type { Prisma } from '@prisma/client'

export const EDUCATION_OPTIONS = ['楂樹腑', '涓笓', '澶т笓', '鏈', '纭曞＋', '鍗氬＋'] as const

export type EducationOption = (typeof EDUCATION_OPTIONS)[number]
export type ProfileVersionType = 'RESUME' | 'PARTY'

type TransactionClient = Prisma.TransactionClient

interface RecordDocumentVersionParams {
  tx: TransactionClient
  type: ProfileVersionType
  userId: string
  currentAttachment: string | null
  nextAttachment: string | null
  userCreatedAt: Date
  remark: string
  effectiveFrom: Date
  createdBy: string
}

export async function recordDocumentVersionIfChanged({
  tx,
  type,
  userId,
  currentAttachment,
  nextAttachment,
  userCreatedAt,
  remark,
  effectiveFrom,
  createdBy,
}: RecordDocumentVersionParams) {
  const normalizedCurrent = currentAttachment || null
  const normalizedNext = nextAttachment || null

  if (!normalizedNext || normalizedCurrent === normalizedNext) {
    return false
  }

  if (type === 'RESUME') {
    const existingCount = await tx.userResumeVersion.count({
      where: { userId },
    })

    if (existingCount === 0 && normalizedCurrent) {
      await tx.userResumeVersion.create({
        data: {
          userId,
          attachment: normalizedCurrent,
          remark: '绯荤粺鍒濆鍖栧巻鍙茬増鏈?',
          effectiveFrom: userCreatedAt,
          effectiveTo: effectiveFrom,
          createdBy,
        },
      })
    } else {
      await tx.userResumeVersion.updateMany({
        where: {
          userId,
          effectiveTo: null,
        },
        data: {
          effectiveTo: effectiveFrom,
        },
      })
    }

    await tx.userResumeVersion.create({
      data: {
        userId,
        attachment: normalizedNext,
        remark,
        effectiveFrom,
        effectiveTo: null,
        createdBy,
      },
    })
  } else {
    const existingCount = await tx.userPartyInfoVersion.count({
      where: { userId },
    })

    if (existingCount === 0 && normalizedCurrent) {
      await tx.userPartyInfoVersion.create({
        data: {
          userId,
          attachment: normalizedCurrent,
          remark: '绯荤粺鍒濆鍖栧巻鍙茬増鏈?',
          effectiveFrom: userCreatedAt,
          effectiveTo: effectiveFrom,
          createdBy,
        },
      })
    } else {
      await tx.userPartyInfoVersion.updateMany({
        where: {
          userId,
          effectiveTo: null,
        },
        data: {
          effectiveTo: effectiveFrom,
        },
      })
    }

    await tx.userPartyInfoVersion.create({
      data: {
        userId,
        attachment: normalizedNext,
        remark,
        effectiveFrom,
        effectiveTo: null,
        createdBy,
      },
    })
  }

  return true
}
