import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

import { authOptions } from '@/lib/auth'
import { getApprovalHistory, getPendingApprovals } from '@/server/actions/approval'

import { ApprovalsClientPage } from './approvals-client-page'

export default async function ApprovalsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/auth/login')
  }

  const viewerRole = session.user.role
  const [initialPendingApps, initialHistory] =
    viewerRole === 'ADMIN' || viewerRole === 'MANAGER'
      ? await Promise.all([getPendingApprovals(), getApprovalHistory()])
      : [{ overtime: [], leave: [], other: [] }, []]

  return (
    <ApprovalsClientPage
      initialHistory={initialHistory}
      initialPendingApps={initialPendingApps}
      viewerRole={viewerRole}
    />
  )
}
