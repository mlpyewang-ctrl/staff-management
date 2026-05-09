import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

import { authOptions } from '@/lib/auth'
import { getCompensatorySourceHistory } from '@/server/actions/compensatory'
import { getLeaveApplications } from '@/server/actions/leave'
import { ensureLeaveBalance } from '@/lib/leave-balance'

import { LeaveClientPage } from './leave-client-page'

export default async function LeavePage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/auth/login')
  }

  const viewerId = session.user.id
  const viewerRole = session.user.role

  if (!viewerId) {
    redirect('/auth/login')
  }

  let initialBalances = null
  try {
    if (viewerId) {
      initialBalances = await ensureLeaveBalance(viewerId)
    }
  } catch {
    initialBalances = null
  }

  const [initialApplications, initialSourceHistory] = await Promise.all([
    getLeaveApplications(),
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
