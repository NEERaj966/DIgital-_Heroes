import { useEffect, useState } from 'react'
import { userApi } from '../utils/api'
import UserPageShell, { MessageBanner, inputClass, panelClass } from './UserPageShell'

const defaultScoreDate = () => new Date().toISOString().split('T')[0]

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const formatMonthLabel = (drawMonth) => {
  const [year, month] = String(drawMonth || '').split('-').map(Number)

  if (!year || !month) {
    return 'Published draw'
  }

  return new Date(year, month - 1, 1).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
  })
}

const UserScoresPage = () => {
  const [scores, setScores] = useState([])
  const [drawResults, setDrawResults] = useState([])
  const [editingScoreId, setEditingScoreId] = useState('')
  const [scoreForm, setScoreForm] = useState({ score: '', playedAt: defaultScoreDate() })
  const [scoresState, setScoresState] = useState({ loading: true, saving: false, message: '', type: '' })

  const loadPageData = async () => {
    setScoresState((prev) => ({ ...prev, loading: true }))

    try {
      const [scoresResponse, drawResultsResponse] = await Promise.all([
        userApi.get('/users/scores'),
        userApi.get('/users/draw-results'),
      ])

      setScores(scoresResponse.data?.data || [])
      setDrawResults(drawResultsResponse.data?.data || [])
      setScoresState((prev) => ({ ...prev, loading: false, message: '', type: '' }))
    } catch (error) {
      setScoresState((prev) => ({
        ...prev,
        loading: false,
        message: error.response?.data?.message || 'Unable to load scores right now.',
        type: 'error',
      }))
    }
  }

  useEffect(() => {
    loadPageData()
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setScoreForm((prev) => ({ ...prev, [name]: value }))
  }

  const resetForm = () => {
    setScoreForm({ score: '', playedAt: defaultScoreDate() })
    setEditingScoreId('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setScoresState((prev) => ({ ...prev, saving: true, message: '', type: '' }))

    try {
      if (editingScoreId) {
        await userApi.patch(`/users/scores/${editingScoreId}`, scoreForm)
      } else {
        await userApi.post('/users/scores', scoreForm)
      }

      await loadPageData()
      resetForm()
      setScoresState((prev) => ({
        ...prev,
        saving: false,
        message: editingScoreId ? 'Score updated successfully.' : 'Score added successfully.',
        type: 'success',
      }))
    } catch (error) {
      setScoresState((prev) => ({
        ...prev,
        saving: false,
        message: error.response?.data?.message || 'Unable to save score right now.',
        type: 'error',
      }))
    }
  }

  return (
    <UserPageShell
      title="Golf Scores"
      description="Add and edit your latest Stableford scores, then review the most recent published draw results that used player scores."
    >
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className={panelClass}>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <input type="number" name="score" min="1" max="45" required value={scoreForm.score} onChange={handleChange} placeholder="Stableford score" className={inputClass} />
              <input type="date" name="playedAt" required value={scoreForm.playedAt} onChange={handleChange} className={inputClass} />
            </div>
            <MessageBanner state={scoresState} />
            <div className="flex gap-3">
              <button type="submit" disabled={scoresState.saving} className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-6 py-3 text-sm font-semibold text-slate-950">
                {scoresState.saving ? 'Saving...' : editingScoreId ? 'Update Score' : 'Add Score'}
              </button>
              {editingScoreId ? (
                <button type="button" onClick={resetForm} className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white">
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className={panelClass}>
          {scoresState.loading ? (
            <p className="text-sm text-slate-300">Loading scores...</p>
          ) : scores.length ? (
            <div className="space-y-4">
              {scores.map((scoreItem) => (
                <div key={scoreItem._id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-white">{scoreItem.stablefordScore} Stableford</p>
                      <p className="mt-1 text-sm text-slate-300">{new Date(scoreItem.playedAt).toLocaleDateString()}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingScoreId(scoreItem._id)
                        setScoreForm({
                          score: String(scoreItem.stablefordScore ?? ''),
                          playedAt: new Date(scoreItem.playedAt).toISOString().split('T')[0],
                        })
                      }}
                      className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-300">No scores added yet.</p>
          )}
        </div>
      </section>

      <section className={panelClass}>
        <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Published Draw Results</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Recent official results</h2>
        <div className="mt-5 space-y-4">
          {drawResults.length ? (
            drawResults.map((result) => {
              const hasPrize = Number(result.userResult?.prizeAmount || 0) > 0

              return (
                <div key={result.drawMonth} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-white">{formatMonthLabel(result.drawMonth)}</p>
                      <p className="mt-1 text-sm text-slate-300">
                        Winning numbers: {(result.winningNumbers || []).join(', ') || 'Not available'}
                      </p>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${hasPrize ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-slate-300'}`}>
                      {hasPrize ? 'Prize Won' : 'Published'}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">3-Match Winners</p>
                      <p className="mt-2 text-lg font-semibold text-white">{result.summary?.threeMatchWinners || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">4-Match Winners</p>
                      <p className="mt-2 text-lg font-semibold text-white">{result.summary?.fourMatchWinners || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">5-Match Winners</p>
                      <p className="mt-2 text-lg font-semibold text-white">{result.summary?.fiveMatchWinners || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Your Prize</p>
                      <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(result.userResult?.prizeAmount || 0)}</p>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <p className="text-sm text-slate-300">Published draw results will appear here after the admin publishes a draw.</p>
          )}
        </div>
      </section>
    </UserPageShell>
  )
}

export default UserScoresPage
