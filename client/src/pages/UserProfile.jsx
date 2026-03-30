import { Link } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { formatSafeSubscriptionPlanName, formatSubscriptionStatus } from '../constants/subscriptionPlans'
import UserPageShell, { panelClass } from './UserPageShell'

const quickLinks = [
  { label: 'Profile Settings', to: '/profile/settings', description: 'Edit personal details, email, password, avatar, and theme.' },
  { label: 'Golf Scores', to: '/profile/scores', description: 'Track and edit your latest Stableford scores.' },
  { label: 'Charity Choice', to: '/profile/charity', description: 'Select the charity connected to your subscription.' },
  { label: 'Participation & Winnings', to: '/profile/winnings', description: 'Review your subscriber activity and reward status.' },
  { label: 'Winner Proof', to: '/profile/proof', description: 'Eligible winners can upload a golf-platform screenshot for review.' },
]

const formatProofStatus = (status) =>
  status
    ? status
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : 'Not Submitted'

const UserProfile = () => {
  const { currentUser } = useUser()

  const summaryCards = currentUser
    ? [
        ['Subscription Plan', formatSafeSubscriptionPlanName(currentUser.subscription?.planCode)],
        ['Subscription Status', formatSubscriptionStatus(currentUser.subscription?.status)],
        ['Selected Charity', currentUser.preferredCharity?.name || 'Not selected yet'],
        ['Winner Proof', formatProofStatus(currentUser.winnerProof?.status)],
      ]
    : []

  const detailItems = currentUser
    ? [
        ['Name', currentUser.name || 'Not added yet'],
        ['Email', currentUser.email || 'Not added yet'],
        ['Sign-In Method', currentUser.authProvider === 'google' ? 'Google' : 'Email and Password'],
        ['Handicap', currentUser.handicap ?? 'Not added yet'],
      ]
    : []

  return (
    <UserPageShell
      title="My Profile"
      description="A clean overview of your subscriber account, with every feature available from its own dedicated page."
    >
      {currentUser ? (
        <>
          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className={`${panelClass} flex flex-col items-center text-center`}>
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name || 'User avatar'}
                  className="h-28 w-28 rounded-full border border-emerald-400/25 object-cover"
                />
              ) : (
                <div className="inline-flex h-28 w-28 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10 text-3xl font-semibold uppercase text-emerald-200">
                  {(currentUser.name || currentUser.email || 'U')
                    .split(' ')
                    .map((word) => word[0])
                    .join('')
                    .slice(0, 2)}
                </div>
              )}
              <h2 className="mt-5 text-3xl font-semibold text-white">{currentUser.name || 'Subscriber'}</h2>
              <p className="mt-2 text-sm text-slate-300">{currentUser.email}</p>
              <div className="mt-5 rounded-full bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200">
                {formatSubscriptionStatus(currentUser.subscription?.status)}
              </div>
              <Link
                to="/profile/settings"
                className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-6 py-3 text-sm font-semibold text-slate-950"
              >
                Edit Profile Settings
              </Link>
            </div>

            <div className={`${panelClass} space-y-6`}>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Account Overview</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Subscriber summary</h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {summaryCards.map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
                    <p className="mt-2 text-lg text-white">{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {detailItems.map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
                    <p className="mt-2 text-base text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={panelClass}>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Subscriber Pages</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Open each feature from its own page</h3>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {quickLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-5 transition hover:bg-white/10"
                >
                  <p className="text-base font-semibold text-white">{item.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </UserPageShell>
  )
}

export default UserProfile
