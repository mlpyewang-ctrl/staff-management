'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const isAdmin = session?.user?.role === 'ADMIN'
  const isManager = session?.user?.role === 'MANAGER'
  const canApprove = isAdmin || isManager

  const navigation = [
    { name: '仪表盘', href: '/dashboard', icon: '📊' },
    { name: '加班申请', href: '/dashboard/overtime', icon: '⏰' },
    { name: '请假管理', href: '/dashboard/leave', icon: '🗓️' },
    { name: '绩效管理', href: '/dashboard/performance', icon: '📈' },
    ...(canApprove ? [{ name: '审批中心', href: '/dashboard/approvals', icon: '✅' }] : []),
    ...(isAdmin ? [{ name: '部门管理', href: '/dashboard/departments', icon: '🏢' }] : []),
    ...(isAdmin ? [{ name: '人员岗位', href: '/dashboard/staff', icon: '👥' }] : []),
    ...(isAdmin ? [{ name: '岗位管理', href: '/dashboard/positions', icon: '💼' }] : []),
    ...(isAdmin ? [{ name: '审批流程', href: '/dashboard/approval-flows', icon: '🧭' }] : []),
    ...(isAdmin ? [{ name: '薪资管理', href: '/dashboard/salary', icon: '💰' }] : []),
    { name: '个人信息', href: '/dashboard/profile', icon: '🙍' },
  ]

  return (
    <div className="hidden border-r bg-white md:flex md:w-64 md:flex-col">
      <div className="flex flex-grow flex-col overflow-y-auto pt-5">
        <nav className="flex-1 space-y-1 px-2 pb-4">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium ${
                pathname === item.href ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="mr-3 text-lg">{item.icon}</span>
              {item.name}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
