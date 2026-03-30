import { Link } from 'react-router-dom'
import { useAdmin } from '../context/AdminContext'
import AdminPageShell, { adminPanelClass } from './AdminPageShell'

const adminLinks = [
  {
    label: 'Admin Settings',
    to: '/admin/settings',
    description: 'Manage admin profile, password, avatar, theme, and permissions.',
  },
  {
    label: 'User Management',
    to: '/admin/users',
    description: 'View and edit user profiles, golf scores, and subscription details.',
  },
  {
    label: 'Draw Management',
    to: '/admin/draws',
    description: 'Configure draw logic, run simulations, and publish results.',
  },
  {
    label: 'Charity Management',
    to: '/admin/charities',
    description: 'Add, edit, delete charities and manage their media.',
  },
  {
    label: 'Winners Management',
    to: '/admin/winners',
    description: 'Review winner submissions and move approved payouts from pending to paid.',
  },
  {
    label: 'Reports & Analytics',
    to: '/admin/reports',
    description: 'Track total users, prize pool, charity totals, and draw statistics.',
  },
]

const AdminProfile = () => {
  const { currentAdmin } = useAdmin()
  const adminUser = currentAdmin?.userId || {}

  const infoCards = [
    ['Admin Name', adminUser.name || 'Administrator'],
    ['Email', adminUser.email || 'Not added yet'],
    ['Sign-In Method', adminUser.authProvider === 'google' ? 'Google' : 'Email and Password'],
    ['Role', adminUser.role || 'admin'],
  ]

  return (
    <AdminPageShell
      title="Admin Hub"
      description="This is the main control center for platform operations. Each admin capability now lives on its own dedicated page."
    >
      {currentAdmin ? (
        <>
          <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <div className={`${adminPanelClass} flex flex-col items-center text-center`}>
              {adminUser.avatar ? (
                <img
                  src={adminUser.avatar}
                  alt={adminUser.name || 'Admin avatar'}
                  className="h-28 w-28 rounded-full border border-amber-300/25 object-cover"
                />
              ) : (
                <div className="inline-flex h-28 w-28 items-center justify-center rounded-full border border-amber-300/25 bg-amber-300/10 text-3xl font-semibold uppercase text-amber-100">
                  {(adminUser.name || adminUser.email || 'A')
                    .split(' ')
                    .map((word) => word[0])
                    .join('')
                    .slice(0, 2)}
                </div>
              )}
              <h2 className="mt-5 text-3xl font-semibold text-white">{adminUser.name || 'Administrator'}</h2>
              <p className="mt-2 text-sm text-slate-300">{adminUser.email || 'Admin account'}</p>
              <div className="mt-5 rounded-full bg-amber-300/10 px-4 py-2 text-sm font-medium text-amber-100">
                Platform Control Access
              </div>
            </div>

            <div className={adminPanelClass}>
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Admin Details</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Session overview</h3>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {infoCards.map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
                    <p className="mt-2 text-base text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={adminPanelClass}>
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Admin Navigation</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Management areas</h3>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {adminLinks.map((item) => (
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
    </AdminPageShell>
  )
}

export default AdminProfile
