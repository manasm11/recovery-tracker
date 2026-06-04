import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200',
  ].join(' ')
}

export function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-full">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">
                R
              </div>
              <span className="text-base font-semibold text-slate-900">Recovery Tracker</span>
            </div>
            <nav className="flex items-center gap-1">
              <NavLink to="/" end className={navClass}>
                Today
              </NavLink>
              <NavLink to="/customers" className={navClass}>
                Customers
              </NavLink>
              <NavLink to="/whatsapp" className={navClass}>
                WhatsApp
              </NavLink>
              {user?.role === 'admin' && (
                <NavLink to="/dashboard" className={navClass}>
                  Dashboard
                </NavLink>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {user?.username} ({user?.role})
            </span>
            <button
              onClick={logout}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
