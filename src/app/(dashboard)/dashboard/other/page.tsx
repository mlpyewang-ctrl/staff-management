import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

import { authOptions } from '@/lib/auth'
import { getOtherApplications } from '@/server/actions/otherApplication'

import { OtherClientPage } from './other-client-page'

export default async function OtherPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/auth/login')
  }

  const viewerId = session.user.id
  const viewerRole = session.user.role

  const initialApplications = await getOtherApplications()

  return (
    <OtherClientPage
      initialApplications={initialApplications}
      viewerId={viewerId}
      viewerRole={viewerRole}
    />
  )
}
