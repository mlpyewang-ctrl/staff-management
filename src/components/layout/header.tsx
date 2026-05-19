'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export function Header({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname()
  const { data: session } = useSession()

  const isAdmin = session?.user?.role === 'ADMIN'

  const navigation = [
    { name: '仪表盘', href: '/dashboard' },
    { name: '加班申请', href: '/dashboard/overtime' },
    { name: '请假管理', href: '/dashboard/leave' },
    { name: '绩效管理', href: '/dashboard/performance' },
    { name: '审批中心', href: '/dashboard/approvals', badge: pendingCount },
    ...(isAdmin ? [{ name: '部门管理', href: '/dashboard/departments' }] : []),
    ...(isAdmin ? [{ name: '人员岗位', href: '/dashboard/staff' }] : []),
    ...(isAdmin ? [{ name: '变更记录', href: '/dashboard/profile-history' }] : []),
    ...(isAdmin ? [{ name: '岗位管理', href: '/dashboard/positions' }] : []),
    { name: '个人信息', href: '/dashboard/profile' },
  ]

  const roleLabel =
    session?.user?.role === 'ADMIN'
      ? '管理员'
      : session?.user?.role === 'MANAGER'
      ? '主管'
      : '员工'

  return (
    <header className="border-b bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <Link href="/dashboard" className="text-xl font-bold text-blue-600">
            劳务派遣管理系统
          </Link>
        </div>

        <nav className="hidden space-x-4 md:flex">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                pathname === item.href ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.name}
              {'badge' in item && item.badge && item.badge > 0 ? (
                <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            {session?.user?.name} ({roleLabel})
          </span>
          <Button
            variant="outline"
            size="sm"
            className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
            onClick={() => signOut({ callbackUrl: window.location.origin + '/auth/login' })}
          >
            退出登录
          </Button>
        </div>
      </div>
    </header>
  )
}
