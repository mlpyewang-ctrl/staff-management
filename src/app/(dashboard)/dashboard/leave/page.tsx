import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

import { authOptions } from '@/lib/auth'
import { getCompensatorySourceHistory } from '@/server/actions/compensatory'
import { getLeaveApplications, getLeaveBalances } from '@/server/actions/leave'

import { LeaveClientPage } from './leave-client-page'

export default async function LeavePage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/auth/login')
  }

  const viewerId = session.user.id
  const viewerRole = session.user.role

  const [initialApplications, initialBalances, initialSourceHistory] = await Promise.all([
    getLeaveApplications(),
    viewerId ? getLeaveBalances(viewerId) : Promise.resolve(null),
    viewerId ? getCompensatorySourceHistory(viewerId) : Promise.resolve([]),
  ])

  return (
    <LeaveClientPage
      initialApplications={initialApplications}
      initialBalances={initialBalances}
      initialSourceHistory={initialSourceHistory}
      viewerId={viewerId}
      viewerRole={viewerRole}
    />
  )
}
