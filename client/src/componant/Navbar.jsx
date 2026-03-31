import { useUser } from '../context/UserContext'
import { useAdmin } from '../context/AdminContext'
import { Link } from 'react-router-dom'
import NavbarMenu from './NavbarMenu'
import { formatSafeSubscriptionPlanName, formatSubscriptionStatus } from '../constants/subscriptionPlans'
import { useTheme } from '../context/ThemeContext'

const Navbar = () => {
  const { currentUser } = useUser()
  const { currentAdmin } = useAdmin()
  const { theme } = useTheme()
  const activeAccount = currentAdmin?.userId || currentUser
  const activeProfileRoute = currentAdmin ? '/admin/profile' : '/profile'
  const userInitials = activeAccount?.name
    ? activeAccount.name
        .split(' ')
        .map((word) => word[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : activeAccount?.email?.slice(0, 2)?.toUpperCase()

  if (currentAdmin) {
    return (
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
        <nav className={`theme-navbar mx-auto flex max-w-7xl flex-col gap-4 rounded-[24px] border px-4 py-4 shadow-[0_20px_80px_rgba(15,23,42,0.4)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6 ${theme === 'light' ? 'border-slate-300/50 text-slate-950' : 'border-white/10 bg-slate-950/80 text-white'}`}>
          <Link
            to="/admin/profile"
            className={`logo-glow inline-flex items-center gap-3 self-start text-sm font-semibold uppercase tracking-[0.18em] sm:text-lg sm:tracking-[0.28em] ${theme === 'light' ? 'text-slate-950' : 'text-white'}`}
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 text-sm font-black text-slate-950 shadow-[0_10px_25px_rgba(251,146,60,0.45)]">
              DH
            </span>
            <span className="hidden min-[420px]:inline">Digital Heroes</span>
          </Link>

          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
            <div className={`theme-status-badge min-w-0 flex-1 rounded-3xl border px-4 py-2 text-left sm:flex-none sm:text-center ${theme === 'light' ? 'border-amber-500/20 bg-white/80' : 'border-amber-300/20 bg-amber-300/10'}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] sm:text-[11px] sm:tracking-[0.24em] ${theme === 'light' ? 'text-amber-700' : 'text-amber-200'}`}>Admin Panel</p>
              <p className={`mt-1 truncate text-xs font-medium sm:text-sm ${theme === 'light' ? 'text-slate-950' : 'text-white'}`}>
                {activeAccount?.name || 'Administrator'}
              </p>
            </div>

            <NavbarMenu />
          </div>
        </nav>
      </header>
    )
  }

  if (currentUser) {
    return (
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
        <nav className={`theme-navbar mx-auto flex max-w-7xl flex-col gap-4 rounded-[24px] border px-4 py-4 shadow-[0_20px_80px_rgba(15,23,42,0.4)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6 ${theme === 'light' ? 'border-slate-300/50 text-slate-950' : 'border-white/10 bg-slate-950/80 text-white'}`}>
          <Link
            to="/profile"
            className={`logo-glow inline-flex items-center gap-3 self-start text-sm font-semibold uppercase tracking-[0.18em] sm:text-lg sm:tracking-[0.28em] ${theme === 'light' ? 'text-slate-950' : 'text-white'}`}
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 text-sm font-black text-slate-950 shadow-[0_10px_25px_rgba(251,146,60,0.45)]">
              DH
            </span>
            <span className="hidden min-[420px]:inline">Digital Heroes</span>
          </Link>

          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
            <div className={`theme-status-badge min-w-0 flex-1 rounded-3xl border px-4 py-2 text-left sm:flex-none sm:text-center ${theme === 'light' ? 'border-emerald-500/20 bg-white/80' : 'border-emerald-400/20 bg-emerald-400/10'}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] sm:text-[11px] sm:tracking-[0.24em] ${theme === 'light' ? 'text-emerald-700' : 'text-emerald-200'}`}>Subscription</p>
              <p className={`mt-1 truncate text-xs font-medium sm:text-sm ${theme === 'light' ? 'text-slate-950' : 'text-white'}`}>
                {formatSafeSubscriptionPlanName(currentUser.subscription?.planCode)} • {formatSubscriptionStatus(currentUser.subscription?.status)}
              </p>
            </div>

            <NavbarMenu />
          </div>
        </nav>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
      <nav className={`theme-navbar navbar-enter mx-auto flex max-w-7xl flex-col gap-4 rounded-[28px] border px-4 py-4 shadow-[0_20px_80px_rgba(15,23,42,0.4)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6 ${theme === 'light' ? 'border-slate-300/50 text-slate-950' : 'border-white/10 bg-slate-950/75 text-white'}`}>
        <a
          href="/"
          className={`logo-glow inline-flex items-center gap-3 self-start text-sm font-semibold uppercase tracking-[0.18em] sm:text-lg sm:tracking-[0.28em] ${theme === 'light' ? 'text-slate-950' : 'text-white'}`}
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 text-sm font-black text-slate-950 shadow-[0_10px_25px_rgba(251,146,60,0.45)]">
            DH
          </span>
          <span className="hidden min-[420px]:inline">Digital Heroes</span>
        </a>

        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
          {activeAccount ? (
            <Link to={activeProfileRoute} className="inline-flex items-center justify-center">
              {activeAccount.avatar ? (
                <img
                  src={activeAccount.avatar}
                  alt={activeAccount.name || 'User avatar'}
                  className="h-11 w-11 rounded-full border border-emerald-400/25 object-cover shadow-[0_10px_24px_rgba(16,185,129,0.18)]"
                />
              ) : (
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200 shadow-[0_10px_24px_rgba(16,185,129,0.18)]">
                  {userInitials || 'U'}
                </div>
              )}
            </Link>
          ) : (
            <Link
              to="/signin"
              className={`nav-link rounded-full px-4 py-2 text-sm font-medium transition-colors duration-300 ${theme === 'light' ? 'text-slate-700 hover:text-slate-950' : 'text-slate-200 hover:text-white'}`}
            >
              Login
            </Link>
          )}

          <Link
            to="/subscription"
            className="subscribe-button inline-flex flex-1 items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_14px_30px_rgba(249,115,22,0.35)] transition-transform duration-300 hover:-translate-y-0.5 sm:flex-none"
          >
            Subscribe
          </Link>

          <NavbarMenu />
        </div>
      </nav>
    </header>
  )
}

export default Navbar
