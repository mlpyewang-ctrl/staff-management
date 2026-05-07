import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

import { authOptions } from '@/lib/auth'
import { getDepartments } from '@/server/actions/department'

import { QueryClientPage } from './query-client-page'

export default async function QueryPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/auth/login')
  }

  if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
    redirect('/dashboard')
  }

  const departments = await getDepartments()

  return (
    <QueryClientPage
      departments={departments}
    />
  )
}
