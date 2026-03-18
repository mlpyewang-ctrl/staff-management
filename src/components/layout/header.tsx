'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export function Header() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const isAdmin = session?.user?.role === 'ADMIN'
  const isManager = session?.user?.role === 'MANAGER'
  const canApprove = isAdmin || isManager

  const navigation = [
    { name: '仪表盘', href: '/dashboard' },
    { name: '加班申请', href: '/dashboard/overtime' },
    { name: '请假管理', href: '/dashboard/leave' },
    { name: '绩效管理', href: '/dashboard/performance' },
    ...(canApprove ? [{ name: '审批中心', href: '/dashboard/approvals' }] : []),
    ...(isAdmin ? [{ name: '部门管理', href: '/dashboard/departments' }] : []),
    ...(isAdmin ? [{ name: '岗位管理', href: '/dashboard/positions' }] : []),
    { name: '个人信息', href: '/dashboard/profile' },
  ]

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="text-xl font-bold text-blue-600">
              劳务派遣管理系统
            </Link>
          </div>
          
          <nav className="hidden md:flex space-x-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  pathname === item.href
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {session?.user?.name} ({session?.user?.role === 'ADMIN' ? '管理员' : session?.user?.role === 'MANAGER' ? '主管' : '员工'})
            </span>
            <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: '/auth/login' })}>
              退出登录
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
