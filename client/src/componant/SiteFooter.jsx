import { Link } from 'react-router-dom'

const footerSections = [
  {
    title: 'Public Visitor',
    items: [
      { label: 'Home', to: '/' },
      { label: 'Subscription Plans', to: '/subscription' },
      { label: 'User Sign In', to: '/signin' },
      { label: 'Create Account', to: '/signup' },
    ],
  },
  {
    title: 'Subscriber Area',
    items: [
      { label: 'My Profile', to: '/profile' },
      { label: 'Golf Scores', to: '/profile/scores' },
      { label: 'Charity Choice', to: '/profile/charity' },
      { label: 'Winnings', to: '/profile/winnings' },
    ],
  },
  {
    title: 'Admin Area',
    items: [
      { label: 'Admin Hub', to: '/admin/profile' },
      { label: 'Draw Management', to: '/admin/draws' },
      { label: 'Winners Management', to: '/admin/winners' },
      { label: 'Reports', to: '/admin/reports' },
    ],
  },
]

const SiteFooter = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-white/10 bg-slate-950/35">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-3 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300 sm:text-sm sm:tracking-[0.3em]">Digital Heroes</p>
            <h2 className="mt-3 text-xl font-semibold text-white sm:text-2xl">Charity golf, subscription access, monthly draws, and winner verification in one platform.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              This footer stays available across the home experience, subscriber pages, and admin pages so visitors and signed-in users always have a clear route through the platform.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {footerSections.map((section) => (
              <div key={section.title} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 sm:tracking-[0.24em]">{section.title}</p>
                <div className="mt-4 space-y-3">
                  {section.items.map((item) => (
                    <Link key={item.to} to={item.to} className="block text-sm text-slate-200 transition hover:text-amber-200">
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 pt-5 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {currentYear} Digital Heroes. Built for visitors, players, charities, and platform admins.</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/" className="transition hover:text-amber-200">
              Home
            </Link>
            <Link to="/subscription" className="transition hover:text-amber-200">
              Subscription
            </Link>
            <Link to="/admin/profile" className="transition hover:text-amber-200">
              Admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
