import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

import { authOptions } from '@/lib/auth'
import { getDepartments } from '@/server/actions/department'
import {
  getSalaryMonths,
  getSalaryRecords,
  getSalaryStats,
} from '@/server/actions/salary'

import { SalaryClientPage } from './salary-client-page'

export default async function SalaryPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/auth/login')
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const [initialRecords, initialStats, initialDepartments, initialMonths] = await Promise.all([
    getSalaryRecords(),
    getSalaryStats(),
    getDepartments(),
    getSalaryMonths(),
  ])

  return (
    <SalaryClientPage
      initialDepartments={initialDepartments}
      initialMonths={initialMonths}
      initialRecords={initialRecords}
      initialStats={initialStats}
    />
  )
}
