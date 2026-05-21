import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'

export default function Layout({ title, children }) {
  return (
    <div className="flex min-h-screen bg-[#0d1117]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title={title} />
        {/* pb-20 on mobile leaves space above the fixed bottom nav */}
        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 overflow-auto">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
