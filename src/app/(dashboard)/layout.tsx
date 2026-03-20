import { Sidebar } from '@/components/layout/sidebar'
import { Providers } from '@/components/providers'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Providers>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fbff,_#eef4ff_38%,_#f8fafc_100%)] md:flex">
        <Sidebar />
        <main className="flex-1 px-4 pb-8 pt-20 md:px-8 md:py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </Providers>
  )
}
