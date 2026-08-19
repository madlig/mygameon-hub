import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--text)]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="fadeUp flex-1 overflow-y-auto px-[var(--pad-card)] pb-28 md:pb-[var(--pad-card)]">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
