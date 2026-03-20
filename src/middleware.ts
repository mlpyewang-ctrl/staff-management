import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

const adminOnlyPaths = [
  '/dashboard/approval-flows',
  '/dashboard/departments',
  '/dashboard/positions',
  '/dashboard/salary',
  '/dashboard/staff',
]

export async function middleware(req: any) {
  const { nextUrl } = req
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  const isAuthPage = nextUrl.pathname.startsWith('/auth/login') || nextUrl.pathname.startsWith('/auth/register')
  const isDashboardPage = nextUrl.pathname.startsWith('/dashboard')
  const isApiAuth = nextUrl.pathname.startsWith('/api/auth')

  if (isApiAuth) {
    return NextResponse.next()
  }

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl))
  }

  if (isDashboardPage && !token) {
    return NextResponse.redirect(new URL('/auth/login', nextUrl))
  }

  if (isDashboardPage && token) {
    const role = (token as any).role as string

    if (nextUrl.pathname.startsWith('/dashboard/approvals') && !['ADMIN', 'MANAGER'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl))
    }

    if (adminOnlyPaths.some((path) => nextUrl.pathname.startsWith(path)) && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', nextUrl))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/auth/login', '/auth/register'],
}
