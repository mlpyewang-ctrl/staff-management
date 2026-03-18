import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: any) {
  const { nextUrl } = req
  
  // 获取 token
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  
  const isAuthPage = nextUrl.pathname.startsWith('/auth/login') || nextUrl.pathname.startsWith('/auth/register')
  const isDashboardPage = nextUrl.pathname.startsWith('/dashboard')
  const isApiAuth = nextUrl.pathname.startsWith('/api/auth')

  // API 路由不需要中间件处理
  if (isApiAuth) {
    return NextResponse.next()
  }

  // 已登录用户访问认证页面，重定向到仪表盘
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl))
  }

  // 未登录用户访问仪表盘，重定向到登录页
  if (isDashboardPage && !token) {
    return NextResponse.redirect(new URL('/auth/login', nextUrl))
  }

  // 角色权限检查
  if (isDashboardPage && token) {
    const role = (token as any).role as string
    
    // 审批页面只有管理员和主管可以访问
    if (nextUrl.pathname.startsWith('/dashboard/approvals')) {
      if (!['ADMIN', 'MANAGER'].includes(role)) {
        return NextResponse.redirect(new URL('/dashboard', nextUrl))
      }
    }
    
    // 岗位管理页面只有管理员可以访问
    if (nextUrl.pathname.startsWith('/dashboard/positions')) {
      if (role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/dashboard', nextUrl))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/auth/login', '/auth/register'],
}
