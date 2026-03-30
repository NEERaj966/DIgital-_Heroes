import { useEffect, useState } from 'react'
import { useUser } from '../context/UserContext'
import { userApi } from '../utils/api'
import { formatSubscriptionStatus } from '../constants/subscriptionPlans'
import UserPageShell, { panelClass } from './UserPageShell'

const formatStatus = (value, fallback = 'Not Eligible Yet') =>
  value
    ? String(value)
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : fallback

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const formatMonthLabel = (drawMonth) => {
  const [year, month] = String(drawMonth || '').split('-').map(Number)
  const monthName = new Date(year || 2000, (month || 1) - 1, 1).toLocaleString('en-IN', { month: 'long' })

  if (!year || !month) {
    return 'Published draw'
  }

  return `${monthName} ${year}`
}

const UserWinningsPage = () => {
  const { currentUser } = useUser()
  const [scoreCount, setScoreCount] = useState(0)
  const [drawResults, setDrawResults] = useState([])

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const [scoresResponse, drawResultsResponse] = await Promise.all([
          userApi.get('/users/scores'),
          userApi.get('/users/draw-results'),
        ])

        setScoreCount((scoresResponse.data?.data || []).length)
        setDrawResults(drawResultsResponse.data?.data || [])
      } catch {
        setScoreCount(0)
        setDrawResults([])
      }
    }

    loadSummary()
  }, [])

  const cards = [
    ['Subscription', formatSubscriptionStatus(currentUser?.subscription?.status)],
    ['Scores Saved', `${scoreCount}/5`],
    ['Selected Charity', currentUser?.preferredCharity?.name || 'Not selected'],
    ['Total Won', formatCurrency(currentUser?.totalWinnings ?? 0)],
    ['Winner Proof', formatStatus(currentUser?.winnerProof?.status, 'Not Submitted')],
    ['Payment Status', formatStatus(currentUser?.payoutStatus)],
  ]

  return (
    <UserPageShell
      title="Participation & Winnings"
      description="Review your total winnings, payout progress, and the latest published draw results in one place."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className={panelClass}>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
            <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className={panelClass}>
          <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Payout Tracking</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Prize transfer status</h2>
          <div className="mt-5 grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">UPI Destination</p>
              <p className="mt-2 text-lg font-semibold text-white">{currentUser?.payoutDetails?.vpa || 'Not added yet'}</p>
              <p className="mt-2 text-sm text-slate-300">
                {currentUser?.payoutDetails?.vpa
                  ? `Beneficiary: ${currentUser?.payoutDetails?.beneficiaryName || currentUser?.name || 'Not set'}`
                  : 'Add your beneficiary name, phone number, and UPI ID in Profile Settings to receive prize money automatically after proof approval.'}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Latest Transfer</p>
              <p className="mt-2 text-lg font-semibold text-white">{formatStatus(currentUser?.latestPayout?.status, 'Not Started')}</p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <p>Reference: {currentUser?.latestPayout?.referenceId || 'Not available yet'}</p>
                <p>UTR: {currentUser?.latestPayout?.utr || 'Will appear after the payout is processed'}</p>
                <p>Amount: {formatCurrency(currentUser?.latestPayout?.amount || currentUser?.totalWinnings || 0)}</p>
                {currentUser?.latestPayout?.failureReason ? <p>Issue: {currentUser.latestPayout.failureReason}</p> : null}
              </div>
            </div>
          </div>
        </div>

        <div className={panelClass}>
          <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Published Results</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Your recent draw history</h2>
          <div className="mt-5 space-y-4">
            {drawResults.length ? (
              drawResults.map((result) => {
                const isWinner = Number(result.userResult?.prizeAmount || 0) > 0

                return (
                  <div key={result.drawMonth} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-lg font-semibold text-white">{formatMonthLabel(result.drawMonth)}</p>
                        <p className="mt-1 text-sm text-slate-300">
                          Winning numbers: {(result.winningNumbers || []).join(', ') || 'Not available'}
                        </p>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${isWinner ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-slate-300'}`}>
                        {isWinner ? 'Winner' : 'No Win'}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Your Match</p>
                        <p className="mt-2 text-lg font-semibold text-white">{result.userResult?.matchCount || 0}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Your Prize</p>
                        <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(result.userResult?.prizeAmount || 0)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Eligible Players</p>
                        <p className="mt-2 text-lg font-semibold text-white">{result.totalEligiblePlayers || 0}</p>
                      </div>
                    </div>

                    {result.userResult?.matchedNumbers?.length ? (
                      <p className="mt-3 text-sm text-slate-300">
                        Matched numbers: {result.userResult.matchedNumbers.join(', ')}
                      </p>
                    ) : null}
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-slate-300">No published draw results are available yet.</p>
            )}
          </div>
        </div>
      </section>
    </UserPageShell>
  )
}

export default UserWinningsPage
