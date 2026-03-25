'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: '/dashboard',
      })

      if (result?.error) {
        setError(result.error)
      } else if (result?.ok) {
        window.location.href = '/dashboard'
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('登录失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">劳务派遣管理系统</CardTitle>
          <p className="text-center text-gray-600">请登录您的账号</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="请输入邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-gray-600">
            还没有账号？{' '}
            <Link href="/auth/register" className="text-blue-600 hover:underline">
              立即注册
            </Link>
          </div>
          <div className="mt-2 text-center text-xs text-gray-500">
            测试账号：admin@zltech.com / password123
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
