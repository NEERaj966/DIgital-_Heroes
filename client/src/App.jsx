import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import Navbar from './componant/Navbar'
import SiteFooter from './componant/SiteFooter'
import { useTheme } from './context/ThemeContext'

const Home = lazy(() => import('./pages/Home'))
const Subscription = lazy(() => import('./pages/Subscription'))
const UserSignIn = lazy(() => import('./pages/UserSignIn'))
const UserSignup = lazy(() => import('./pages/UserSignup'))
const UserSubscriberHub = lazy(() => import('./pages/UserSubscriberHub'))
const UserSettingsPage = lazy(() => import('./pages/UserSettingsPage'))
const UserScoresPage = lazy(() => import('./pages/UserScoresPage'))
const UserCharityPage = lazy(() => import('./pages/UserCharityPage'))
const UserWinningsPage = lazy(() => import('./pages/UserWinningsPage'))
const UserWinnerProofPage = lazy(() => import('./pages/UserWinnerProofPage'))
const AdminSignIn = lazy(() => import('./pages/AdminSignIn'))
const AdminSignup = lazy(() => import('./pages/AdminSignup'))
const AdminProfile = lazy(() => import('./pages/AdminProfile'))
const AdminSettingsPage = lazy(() => import('./pages/AdminSettingsPage'))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'))
const AdminDrawsPage = lazy(() => import('./pages/AdminDrawsPage'))
const AdminCharitiesPage = lazy(() => import('./pages/AdminCharitiesPage'))
const AdminWinnersPage = lazy(() => import('./pages/AdminWinnersPage'))
const AdminReportsPage = lazy(() => import('./pages/AdminReportsPage'))

const RouteFrame = ({ children, className = 'mx-auto w-full max-w-5xl' }) => (
  <section className={className}>{children}</section>
)

export const App = () => {
  const { theme } = useTheme()

  return (
    <div
      id="top"
      className={`min-h-screen ${
        theme === 'light'
          ? 'bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_30%),linear-gradient(135deg,_#fff7ed_0%,_#f8fafc_55%,_#e2e8f0_100%)] text-slate-950'
          : 'bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_28%),linear-gradient(135deg,_#020617_0%,_#0f172a_55%,_#1e293b_100%)] text-white'
      }`}
    >
      <Navbar />

      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        <Suspense
          fallback={
            <div className="rounded-[28px] border border-white/10 bg-white/5 px-6 py-10 text-center text-sm font-medium text-slate-300">
              Loading page...
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/subscription" element={<RouteFrame className="mx-auto w-full max-w-6xl"><Subscription /></RouteFrame>} />
            <Route path="/signin" element={<RouteFrame className="mx-auto w-full max-w-3xl"><UserSignIn /></RouteFrame>} />
            <Route path="/signup" element={<RouteFrame className="mx-auto w-full max-w-4xl"><UserSignup /></RouteFrame>} />
            <Route path="/profile" element={<RouteFrame><UserSubscriberHub /></RouteFrame>} />
            <Route path="/profile/settings" element={<RouteFrame><UserSettingsPage /></RouteFrame>} />
            <Route path="/profile/scores" element={<RouteFrame><UserScoresPage /></RouteFrame>} />
            <Route path="/profile/charity" element={<RouteFrame><UserCharityPage /></RouteFrame>} />
            <Route path="/profile/winnings" element={<RouteFrame><UserWinningsPage /></RouteFrame>} />
            <Route path="/profile/proof" element={<RouteFrame><UserWinnerProofPage /></RouteFrame>} />
            <Route path="/admin/signin" element={<RouteFrame className="mx-auto w-full max-w-3xl"><AdminSignIn /></RouteFrame>} />
            <Route path="/admin/signup" element={<RouteFrame><AdminSignup /></RouteFrame>} />
            <Route path="/admin/profile" element={<RouteFrame><AdminProfile /></RouteFrame>} />
            <Route path="/admin/settings" element={<RouteFrame className="mx-auto w-full max-w-6xl"><AdminSettingsPage /></RouteFrame>} />
            <Route path="/admin/users" element={<RouteFrame className="mx-auto w-full max-w-6xl"><AdminUsersPage /></RouteFrame>} />
            <Route path="/admin/draws" element={<RouteFrame className="mx-auto w-full max-w-6xl"><AdminDrawsPage /></RouteFrame>} />
            <Route path="/admin/charities" element={<RouteFrame className="mx-auto w-full max-w-6xl"><AdminCharitiesPage /></RouteFrame>} />
            <Route path="/admin/winners" element={<RouteFrame className="mx-auto w-full max-w-6xl"><AdminWinnersPage /></RouteFrame>} />
            <Route path="/admin/reports" element={<RouteFrame className="mx-auto w-full max-w-6xl"><AdminReportsPage /></RouteFrame>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  )
}
