import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Daily Feed' },
  { to: '/knowledge', label: 'Knowledge Base' },
  { to: '/stock', label: 'TSLA Stock' },
]

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-surface-1/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 bg-tesla-red rounded-lg flex items-center justify-center font-display font-bold text-white text-sm tracking-tight">
                TTT
              </div>
              <div>
                <h1 className="text-base font-display font-semibold text-text-primary leading-tight">
                  The Tesla Thesis
                </h1>
                <p className="text-[11px] text-text-muted leading-tight tracking-wide uppercase">
                  Intelligence Dashboard
                </p>
              </div>
            </NavLink>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-surface-3 text-text-primary'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-text-muted">
            The Tesla Thesis &mdash; Independent research & analysis. Not financial advice.
          </p>
        </div>
      </footer>
    </div>
  )
}
