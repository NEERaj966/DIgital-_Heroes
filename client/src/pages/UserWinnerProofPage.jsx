import { useState } from 'react'
import { userApi } from '../utils/api'
import { useUser } from '../context/UserContext'
import UserPageShell, { MessageBanner, panelClass } from './UserPageShell'

const formatProofStatus = (status) =>
  status
    ? status
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : 'Not Submitted'

const formatPayoutStatus = (status) =>
  status
    ? status
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : 'Not Eligible Yet'

const UserWinnerProofPage = () => {
  const { currentUser, refreshUserSession } = useUser()
  const [proofFile, setProofFile] = useState(null)
  const [state, setState] = useState({ saving: false, message: '', type: '' })
  const isProofEligible = Number(currentUser?.totalWinnings || 0) > 0 && currentUser?.payoutStatus === 'pending'

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!isProofEligible) {
      setState({
        saving: false,
        message: 'Proof upload is available only for winners whose payout is still pending.',
        type: 'error',
      })
      return
    }

    if (!proofFile) {
      setState({ saving: false, message: 'Please choose a file first.', type: 'error' })
      return
    }

    setState({ saving: true, message: '', type: '' })

    try {
      const formData = new FormData()
      formData.append('proof', proofFile)
      await userApi.patch('/users/winner-proof', formData)
      await refreshUserSession()
      setProofFile(null)
      setState({ saving: false, message: 'Winner proof uploaded successfully.', type: 'success' })
    } catch (error) {
      setState({
        saving: false,
        message: error.response?.data?.message || 'Unable to upload proof right now.',
        type: 'error',
      })
    }
  }

  return (
    <UserPageShell
      title="Winner Proof"
      description="Winners can upload a screenshot from the golf platform here for verification. Once admin approves it, the app can start the payout to your saved UPI ID."
    >
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className={panelClass}>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Current Status</p>
          <p className="mt-3 text-2xl font-semibold text-white">{formatProofStatus(currentUser?.winnerProof?.status)}</p>
          <p className="mt-2 text-sm text-slate-300">Payout status: {formatPayoutStatus(currentUser?.payoutStatus)}</p>
          <p className="mt-2 text-sm text-slate-300">Total winnings: ₹{currentUser?.totalWinnings ?? 0}</p>
          <p className="mt-2 text-sm text-slate-300">
            {currentUser?.winnerProof?.uploadedAt
              ? `Last uploaded on ${new Date(currentUser.winnerProof.uploadedAt).toLocaleDateString()}`
              : 'No proof uploaded yet.'}
          </p>
          <p className="mt-4 text-sm text-slate-300">
            Upload a screenshot of your score from the golf platform. Admin will review it and either approve or reject the submission before your saved payout details are used for the prize transfer.
          </p>
          {currentUser?.winnerProof?.proofUrl ? (
            <a href={currentUser.winnerProof.proofUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm font-medium text-amber-300">
              View Current Proof
            </a>
          ) : null}
        </div>

        <div className={panelClass}>
          {!isProofEligible ? (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
              Proof upload unlocks only after you become a winner and your payout status moves to pending.
            </div>
          ) : null}
          <form onSubmit={handleSubmit} className="grid gap-4">
            <input
              type="file"
              onChange={(event) => setProofFile(event.target.files?.[0] || null)}
              accept="image/png,image/jpeg,image/webp"
              disabled={!isProofEligible || state.saving}
              className="w-full rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-amber-300 file:px-4 file:py-2 file:font-semibold file:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <MessageBanner state={state} />
            <button
              type="submit"
              disabled={state.saving || !isProofEligible}
              className="inline-flex w-fit items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-6 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state.saving ? 'Uploading...' : 'Upload Proof'}
            </button>
          </form>
        </div>
      </section>
    </UserPageShell>
  )
}

export default UserWinnerProofPage
