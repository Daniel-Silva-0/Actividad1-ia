import { useState } from 'react'
import Sidebar from './Sidebar.jsx'
import { pageTitles } from './navigation.js'

export default function Layout({
  children,
  activePage = 'dashboard',
  onNavigate,
  systemStatus = 'Sistema operativo',
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  function handleNavigate(page) {
    onNavigate?.(page)
    setIsSidebarOpen(false)
  }

  return (
    <div className="min-h-screen bg-[#f7f6f3] text-stone-800 md:flex">
      <Sidebar
        activePage={activePage}
        isOpen={isSidebarOpen}
        onNavigate={handleNavigate}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b border-stone-200 bg-white px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Abrir menú"
              aria-expanded={isSidebarOpen}
              className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 md:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-sm font-medium text-stone-800">
              {pageTitles[activePage] ?? 'Art.Monia Decor'}
            </h1>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full bg-[#e9ebe5] px-3 py-1 text-xs font-medium text-[#46513e]">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-emerald-600"
            />
            {systemStatus}
          </span>
        </header>

        <main className="mx-auto max-w-7xl p-5 sm:p-8">{children}</main>
      </div>
    </div>
  )
}
