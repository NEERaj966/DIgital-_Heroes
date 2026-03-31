import { Link } from 'react-router-dom'
import { useUser } from '../context/UserContext'

export const panelClass = 'theme-panel rounded-[28px] border border-white/10 bg-slate-950/70 p-5 sm:p-6'
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
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300 sm:text-sm sm:tracking-[0.35em]">Registered Subscriber</p>
        <h2 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">Checking your access...</h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
          We are validating your saved session and subscription status.
        </p>
      </section>
    )
  }

  if (!currentUser) {
    return (
      <section className={panelClass}>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300 sm:text-sm sm:tracking-[0.35em]">Registered Subscriber</p>
        <h2 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">Please sign in first.</h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
          Your subscriber pages are only available for users with an active subscription.
        </p>
        {sessionNotice ? (
          <div className="mt-6 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            {sessionNotice}
          </div>
        ) : null}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/signin" className="rounded-full border border-white/10 bg-white/10 px-5 py-3 text-center text-sm font-semibold text-white">
            Go To Sign In
          </Link>
          <Link to="/subscription" className="rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-5 py-3 text-center text-sm font-semibold text-slate-950">
            View Plans
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className={panelClass}>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300 sm:text-sm sm:tracking-[0.35em]">Registered Subscriber</p>
        <h1 className="mt-4 text-2xl font-semibold text-white sm:text-3xl md:text-4xl">{title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">{description}</p>
      </div>
      {children}
    </section>
  )
}

export default UserPageShell
