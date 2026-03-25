'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`))
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)

  const isAdmin = session?.user?.role === 'ADMIN'
  const isManager = session?.user?.role === 'MANAGER'
  const canApprove = isAdmin || isManager

  const navigation = useMemo(
    () => [
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
    ],
    [canApprove, isAdmin]
  )

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  const roleLabel =
    session?.user?.role === 'ADMIN'
      ? '系统管理员'
      : session?.user?.role === 'MANAGER'
      ? '部门主管'
      : '员工账号'

  const currentPageName = useMemo(
    () => navigation.find((item) => isActivePath(pathname, item.href))?.name || '工作台',
    [navigation, pathname]
  )

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-lg text-white shadow-lg md:hidden"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? '关闭侧边菜单' : '打开侧边菜单'}
      >
        {isOpen ? '×' : '≡'}
      </button>

      {isOpen && (
        <button
          type="button"
          aria-label="关闭侧边菜单遮罩"
          className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-slate-950 text-slate-100 shadow-2xl transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="border-b border-white/10 px-5 py-6">
          <Link href="/dashboard" className="block">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Staff Management
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              劳务派遣管理系统
            </div>
          </Link>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Current User
            </div>
            <div className="mt-3 text-base font-semibold text-white">
              {session?.user?.name || '未登录'}
            </div>
            <div className="mt-1 text-sm text-slate-300">{roleLabel}</div>
            <div className="mt-3 text-xs text-slate-400">
              当前页面：{currentPageName}
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors',
                isActivePath(pathname, item.href)
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl text-lg transition-colors',
                  isActivePath(pathname, item.href)
                    ? 'bg-slate-100 text-slate-900'
                    : 'bg-white/10 text-white group-hover:bg-white/15'
                )}
              >
                {item.icon}
              </span>
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 px-5 py-5">
          <Button
            variant="outline"
            className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
          >
            退出登录
          </Button>
        </div>
      </aside>
    </>
  )
}
