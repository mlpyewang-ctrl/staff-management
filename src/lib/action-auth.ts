import type { Session } from 'next-auth'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import type { Role } from '@/types'

type SessionUser = Session['user']

export function isAdminRole(role: Role) {
  return role === 'ADMIN'
}

export function hasManagerAccess(role: Role) {
  return role === 'ADMIN' || role === 'MANAGER'
}

export async function requireSessionUser(): Promise<SessionUser> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw new Error('请先登录后再操作')
  }

  return session.user
}

export async function requireAdminUser() {
  const sessionUser = await requireSessionUser()

  if (!isAdminRole(sessionUser.role)) {
    throw new Error('只有管理员可以执行此操作')
  }

  return sessionUser
}

export async function requireManagerUser() {
  const sessionUser = await requireSessionUser()

  if (!hasManagerAccess(sessionUser.role)) {
    throw new Error('只有主管或管理员可以执行此操作')
  }

  return sessionUser
}

export async function requireSelfOrAdmin(targetUserId: string) {
  const sessionUser = await requireSessionUser()

  if (!isAdminRole(sessionUser.role) && sessionUser.id !== targetUserId) {
    throw new Error('无权访问该用户信息')
  }

  return sessionUser
}

export async function requireSelfOrManager(targetUserId: string) {
  const sessionUser = await requireSessionUser()

  if (!hasManagerAccess(sessionUser.role) && sessionUser.id !== targetUserId) {
    throw new Error('无权访问该用户信息')
  }

  return sessionUser
}
