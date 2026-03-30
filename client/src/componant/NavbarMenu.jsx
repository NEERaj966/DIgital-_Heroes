import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { useAdmin } from '../context/AdminContext'
import { useTheme } from '../context/ThemeContext'
import { adminApi, userApi } from '../utils/api'

const menuVariants = {
  hidden: {
    opacity: 0,
    y: -10,
    scale: 0.96,
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.25,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.97,
    transition: {
      duration: 0.18,
      ease: 'easeInOut',
    },
  },
}

const signedInItems = [
  { label: 'Subscriber Hub', to: '/profile', hint: 'Profile, settings, and status' },
  { label: 'Profile & Settings', to: '/profile/settings', hint: 'Manage account details' },
  { label: 'Golf Scores', to: '/profile/scores', hint: 'Enter and edit scores' },
  { label: 'Charity Choice', to: '/profile/charity', hint: 'Choose your recipient' },
  { label: 'Winnings', to: '/profile/winnings', hint: 'View draws and winnings' },
  { label: 'Winner Proof', to: '/profile/proof', hint: 'Upload proof for review' },
]

const adminItems = [
  { label: 'Admin Hub', to: '/admin/profile', hint: 'Profile and control center' },
  { label: 'Admin Settings', to: '/admin/settings', hint: 'Profile, security, appearance' },
  { label: 'User Management', to: '/admin/users', hint: 'Profiles, scores, subscriptions' },
  { label: 'Draw Management', to: '/admin/draws', hint: 'Logic, simulations, publishing' },
  { label: 'Charity Management', to: '/admin/charities', hint: 'Add, edit, delete charities' },
  { label: 'Winners Management', to: '/admin/winners', hint: 'Verify and complete payouts' },
  { label: 'Reports & Analytics', to: '/admin/reports', hint: 'Users, prize pool, draw stats' },
]

const guestItems = [
  { label: 'Sign In', to: '/signin', hint: 'Access your account' },
  { label: 'Create Account', to: '/signup', hint: 'Join the platform' },
  { label: 'Admin Sign In', to: '/admin/signin', hint: 'Admin access' },
  { label: 'Create Admin', to: '/admin/signup', hint: 'Set up admin access' },
]

const NavbarMenu = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const menuRef = useRef(null)
  const { currentUser, clearUserSession } = useUser()
  const { currentAdmin, clearAdminSession } = useAdmin()
  const { theme } = useTheme()
  const navigate = useNavigate()

  const menuItems = currentAdmin ? adminItems : currentUser ? signedInItems : guestItems

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleLogout = async () => {
    setIsLoggingOut(true)

    try {
      if (currentAdmin) {
        await adminApi.get('/admins/logout')
      } else if (currentUser) {
        await userApi.get('/users/logout')
      }
    } catch {
      // Clear local session even if the backend logout request fails.
    } finally {
      if (currentAdmin) {
        clearAdminSession()
      }

      if (currentUser) {
        clearUserSession()
      }

      setIsLoggingOut(false)
      setIsOpen(false)
      navigate(currentAdmin ? '/admin/signin' : '/signin')
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <motion.button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        whileTap={{ scale: 0.94 }}
        className={`theme-menu-button inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-[0_12px_30px_rgba(15,23,42,0.18)] backdrop-blur-md ${theme === 'light' ? 'border-slate-300/50 text-slate-950' : 'border-white/10 bg-white/5 text-white'}`}
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
      >
        <div className="flex h-5 w-5 flex-col items-center justify-center gap-1">
          <motion.span
            animate={isOpen ? { rotate: 45, y: 6, width: 18 } : { rotate: 0, y: 0, width: 18 }}
            className={`block h-0.5 rounded-full ${theme === 'light' ? 'bg-slate-950' : 'bg-white'}`}
          />
          <motion.span
            animate={isOpen ? { opacity: 0, x: -6 } : { opacity: 1, x: 0 }}
            className={`block h-0.5 w-4 rounded-full ${theme === 'light' ? 'bg-slate-950' : 'bg-white'}`}
          />
          <motion.span
            animate={isOpen ? { rotate: -45, y: -6, width: 18 } : { rotate: 0, y: 0, width: 18 }}
            className={`block h-0.5 rounded-full ${theme === 'light' ? 'bg-slate-950' : 'bg-white'}`}
          />
        </div>
      </motion.button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial="hidden"
            animate="show"
            exit="exit"
            variants={menuVariants}
            className={`theme-menu-panel menu-scrollbar absolute right-0 top-14 z-50 max-h-[70vh] w-72 overflow-y-auto rounded-[28px] border p-3 shadow-[0_30px_80px_rgba(15,23,42,0.42)] backdrop-blur-xl ${theme === 'light' ? 'border-slate-300/50' : 'border-white/10 bg-slate-950/92'}`}
          >
            <div className={`menu-panel rounded-[22px] border p-4 ${theme === 'light' ? 'border-slate-200/80' : 'border-white/5'}`}>
              {(currentUser || currentAdmin) ? (
                <div className={`rounded-2xl border px-4 py-3 ${theme === 'light' ? 'border-slate-200 bg-slate-50' : 'border-white/5 bg-white/5'}`}>
                  <p className={`text-sm font-semibold ${theme === 'light' ? 'text-slate-950' : 'text-white'}`}>
                    {currentAdmin?.userId?.name || currentUser?.name || 'Account'}
                  </p>
                  <p className={`mt-1 text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                    {currentAdmin?.userId?.email || currentUser?.email || 'Signed in'}
                  </p>
                </div>
              ) : null}

              <p className={`${currentUser || currentAdmin ? 'mt-4' : ''} text-xs font-semibold uppercase tracking-[0.32em] text-amber-300`}>
                Quick Menu
              </p>

              <div className="mt-4 flex flex-col gap-2">
                {menuItems.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={() => setIsOpen(false)}
                    className={`rounded-2xl border px-4 py-3 transition ${theme === 'light' ? 'border-slate-200 bg-white hover:border-amber-300/30 hover:bg-orange-50' : 'border-white/5 bg-white/5 hover:border-amber-300/20 hover:bg-white/10'}`}
                  >
                    <p className={`text-sm font-semibold ${theme === 'light' ? 'text-slate-950' : 'text-white'}`}>{item.label}</p>
                    <p className={`mt-1 text-xs uppercase tracking-[0.2em] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{item.hint}</p>
                  </Link>
                ))}
              </div>

              {currentAdmin || currentUser ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="mt-4 w-full rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/15"
                >
                  {isLoggingOut ? 'Logging Out...' : 'Logout'}
                </button>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export default NavbarMenu
