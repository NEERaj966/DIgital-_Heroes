import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '../utils/api'
import AdminPageShell, { AdminMessageBanner, adminInputClass, adminPanelClass } from './AdminPageShell'

const formatStatus = (value, fallback = 'Not Submitted') =>
  value
    ? String(value)
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : fallback

const AdminWinnersPage = () => {
  const [winners, setWinners] = useState([])
  const [state, setState] = useState({ message: '', type: '', loading: true })

  const loadWinners = useCallback(async () => {
    setState({ message: '', type: '', loading: true })
    try {
      const response = await adminApi.get('/admins/winners')
      setWinners(response.data?.data || [])
      setState({ message: '', type: '', loading: false })
    } catch (error) {
      setState({
        message: error.response?.data?.message || 'Unable to load winners right now.',
        type: 'error',
        loading: false,
      })
    }
  }, [])

  useEffect(() => {
    loadWinners()
  }, [loadWinners])

  const handleUpdate = async (winnerId, updates) => {
    try {
      const response = await adminApi.patch(`/admins/winners/${winnerId}`, updates)
      await loadWinners()
      setState({ message: response.data?.message || 'Winner record updated successfully.', type: 'success', loading: false })
    } catch (error) {
      setState({
        message: error.response?.data?.message || 'Unable to update winner right now.',
        type: 'error',
        loading: false,
      })
    }
  }

  return (
    <AdminPageShell
      title="Winners Management"
      description="Review winner screenshots, approve or reject submissions, and complete payouts manually or automatically."
    >
      <section className={adminPanelClass}>
        <AdminMessageBanner state={state} />
        <div className="mt-4 space-y-4">
          {state.loading ? (
            <p className="text-sm text-slate-300">Loading winners...</p>
          ) : winners.length ? (
            winners.map((winner) => (
              <AdminWinnerRow
                key={`${winner._id}-${winner.winnerProof?.status || 'not_submitted'}-${winner.payoutStatus || 'pending'}-${winner.totalWinnings || 0}`}
                winner={winner}
                onSave={handleUpdate}
              />
            ))
          ) : (
            <p className="text-sm text-slate-300">No winners available yet.</p>
          )}
        </div>
      </section>
    </AdminPageShell>
  )
}

const AdminWinnerRow = ({ winner, onSave }) => {
  const [winnerProofStatus, setWinnerProofStatus] = useState(winner.winnerProof?.status || 'not_submitted')
  const [payoutStatus, setPayoutStatus] = useState(winner.payoutStatus || 'pending')
  const [totalWinnings, setTotalWinnings] = useState(winner.totalWinnings || 0)
  const canMarkPaid = winnerProofStatus === 'approved'
  const hasPayoutDetails = Boolean(
    (winner.payoutDetails?.beneficiaryName || winner.name) &&
      (winner.payoutDetails?.email || winner.email)
  )

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-lg font-semibold text-white">{winner.name}</p>
          <p className="mt-1 text-sm text-slate-300">{winner.email}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-400">
            Charity: {winner.preferredCharity?.name || 'Not selected'}
          </p>
          <p className="mt-2 text-sm text-slate-300">Proof: {formatStatus(winner.winnerProof?.status)}</p>
          <p className="mt-1 text-sm text-slate-300">Payment: {formatStatus(winner.payoutStatus, 'Pending')}</p>
          <p className="mt-1 text-sm text-slate-300">Beneficiary: {winner.payoutDetails?.beneficiaryName || winner.name || 'Not added'}</p>
          <p className="mt-1 text-sm text-slate-300">Payout Email: {winner.payoutDetails?.email || winner.email || 'Not added'}</p>
          <p className="mt-1 text-sm text-slate-300">Stripe Recipient: {winner.payoutDetails?.stripeRecipientId || 'Not created yet'}</p>
          {!hasPayoutDetails ? (
            <p className="mt-1 text-xs text-rose-300">User must add beneficiary name and payout email before Stripe can prepare the winner transfer.</p>
          ) : null}
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-[540px]">
          <select value={winnerProofStatus} onChange={(event) => setWinnerProofStatus(event.target.value)} className={adminInputClass}>
            <option value="not_submitted" className="bg-slate-900 text-white">not_submitted</option>
            <option value="pending" className="bg-slate-900 text-white">pending</option>
            <option value="approved" className="bg-slate-900 text-white">approved</option>
            <option value="rejected" className="bg-slate-900 text-white">rejected</option>
          </select>
          <select value={payoutStatus} onChange={(event) => setPayoutStatus(event.target.value)} className={adminInputClass}>
            <option value="pending" className="bg-slate-900 text-white">pending</option>
            <option value="paid" className="bg-slate-900 text-white" disabled={!canMarkPaid || !hasPayoutDetails}>paid</option>
          </select>
          <input type="number" value={totalWinnings} onChange={(event) => setTotalWinnings(event.target.value)} className={adminInputClass} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onSave(winner._id, { winnerProofStatus, payoutStatus: canMarkPaid ? payoutStatus : 'pending', totalWinnings })}
          className="rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-5 py-2.5 text-sm font-semibold text-slate-950"
        >
          Save Winner
        </button>
        {winner.winnerProof?.proofUrl ? (
          <a href={winner.winnerProof.proofUrl} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white">
            View Proof
          </a>
        ) : null}
      </div>
    </div>
  )
}

export default AdminWinnersPage
