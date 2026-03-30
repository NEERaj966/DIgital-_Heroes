import { Link } from 'react-router-dom'
import { useUser } from '../context/UserContext'

export const panelClass = 'theme-panel rounded-[28px] border border-white/10 bg-slate-950/70 p-6'
export const inputClass =
  'theme-input w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-amber-300/60 focus:bg-white/10'

export const MessageBanner = ({ state }) =>
  state?.message ? (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        state.type === 'success'
          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
          : 'border-rose-400/30 bg-rose-400/10 text-rose-200'
      }`}
    >
      {state.message}
    </div>
  ) : null

const UserPageShell = ({ title, description, children }) => {
  const { currentUser, isSessionLoading, sessionNotice } = useUser()

  if (isSessionLoading) {
    return (
      <section className={panelClass}>
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">Registered Subscriber</p>
        <h2 className="mt-4 text-3xl font-semibold text-white">Checking your access...</h2>
        <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
          We are validating your saved session and subscription status.
        </p>
      </section>
    )
  }

  if (!currentUser) {
    return (
      <section className={panelClass}>
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">Registered Subscriber</p>
        <h2 className="mt-4 text-3xl font-semibold text-white">Please sign in first.</h2>
        <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
          Your subscriber pages are only available for users with an active subscription.
        </p>
        {sessionNotice ? (
          <div className="mt-6 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            {sessionNotice}
          </div>
        ) : null}
        <div className="mt-8 flex gap-3">
          <Link to="/signin" className="rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white">
            Go To Sign In
          </Link>
          <Link to="/subscription" className="rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-5 py-3 text-sm font-semibold text-slate-950">
            View Plans
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className={panelClass}>
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">Registered Subscriber</p>
        <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">{description}</p>
      </div>
      {children}
    </section>
  )
}

export default UserPageShell
