import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '../utils/api'
import AdminPageShell, { AdminMessageBanner, adminInputClass, adminPanelClass } from './AdminPageShell'

const defaultForm = {
  logicMode: 'random',
  algorithmicPreference: 'most_frequent',
  fiveMatchJackpot: 50000,
  fourMatchPrize: 10000,
  threeMatchPrize: 2500,
  simulationRuns: 100,
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const formatMonthLabel = (drawMonth) => {
  const [year, month] = String(drawMonth || '').split('-').map(Number)

  if (!year || !month || !monthNames[month - 1]) {
    return 'Current Month'
  }

  return `${monthNames[month - 1]} ${year}`
}

const formatStatus = (value) =>
  String(value || 'draft')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const buildFormFromDraw = (draw) => ({
  logicMode: draw?.logicMode || defaultForm.logicMode,
  algorithmicPreference: draw?.algorithmicPreference || defaultForm.algorithmicPreference,
  fiveMatchJackpot: draw?.prizeConfig?.fiveMatchJackpot ?? defaultForm.fiveMatchJackpot,
  fourMatchPrize: draw?.prizeConfig?.fourMatchPrize ?? defaultForm.fourMatchPrize,
  threeMatchPrize: draw?.prizeConfig?.threeMatchPrize ?? defaultForm.threeMatchPrize,
  simulationRuns: draw?.simulation?.runs ?? defaultForm.simulationRuns,
})

const hasPendingConfigChanges = (draw, form) => {
  if (!draw) {
    return false
  }

  return (
    draw.logicMode !== form.logicMode ||
    draw.algorithmicPreference !== form.algorithmicPreference ||
    Number(draw.prizeConfig?.fiveMatchJackpot ?? 0) !== Number(form.fiveMatchJackpot) ||
    Number(draw.prizeConfig?.fourMatchPrize ?? 0) !== Number(form.fourMatchPrize) ||
    Number(draw.prizeConfig?.threeMatchPrize ?? 0) !== Number(form.threeMatchPrize)
  )
}

const NumberPill = ({ value }) => (
  <span className="inline-flex min-w-10 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm font-semibold text-amber-100">
    {value}
  </span>
)

const StatCard = ({ label, value, helper }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
    <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    {helper ? <p className="mt-2 text-sm text-slate-300">{helper}</p> : null}
  </div>
)

const WinnersPreview = ({ winners }) => {
  if (!winners?.length) {
    return <p className="text-sm text-slate-300">No 3-match, 4-match, or 5-match winners in the current preview.</p>
  }

  return (
    <div className="space-y-3">
      {winners.slice(0, 6).map((winner) => (
        <div key={`${winner.userId}-${winner.matchCount}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">{winner.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{winner.matchCount}-number match</p>
            </div>
            <p className="text-sm font-semibold text-amber-200">{formatCurrency(winner.prizeAmount)}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {winner.matchedNumbers.map((number) => (
              <NumberPill key={`${winner.userId}-${number}`} value={number} />
            ))}
          </div>
        </div>
      ))}
      {winners.length > 6 ? <p className="text-xs text-slate-400">Showing the first 6 winners from the preview.</p> : null}
    </div>
  )
}

const FrequencyList = ({ title, items, helper }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
    <p className="text-sm font-semibold text-white">{title}</p>
    {helper ? <p className="mt-1 text-xs text-slate-400">{helper}</p> : null}
    {items?.length ? (
      <div className="mt-4 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={`${title}-${item.score}`} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/60 px-3 py-2 text-xs font-medium text-slate-200">
            <span>{item.score}</span>
            <span className="text-slate-400">x{item.count}</span>
          </span>
        ))}
      </div>
    ) : (
      <p className="mt-3 text-sm text-slate-300">No score frequency data yet.</p>
    )}
  </div>
)

const AdminDrawsPage = () => {
  const [draw, setDraw] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [state, setState] = useState({
    loading: true,
    saving: false,
    simulating: false,
    publishing: false,
    message: '',
    type: '',
  })

  const applyDrawData = useCallback((nextDraw, message = '', type = '') => {
    setDraw(nextDraw)
    setForm(buildFormFromDraw(nextDraw))
    setState({
      loading: false,
      saving: false,
      simulating: false,
      publishing: false,
      message,
      type,
    })
  }, [])

  const loadDraw = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, message: '', type: '' }))

    try {
      const response = await adminApi.get('/admins/draws/current')
      applyDrawData(response.data?.data)
    } catch (error) {
      setState({
        loading: false,
        saving: false,
        simulating: false,
        publishing: false,
        message: error.response?.data?.message || 'Unable to load the monthly draw right now.',
        type: 'error',
      })
    }
  }, [applyDrawData])

  useEffect(() => {
    loadDraw()
  }, [loadDraw])

  const handleFieldChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const buildPayload = () => ({
    logicMode: form.logicMode,
    algorithmicPreference: form.algorithmicPreference,
    fiveMatchJackpot: Number(form.fiveMatchJackpot),
    fourMatchPrize: Number(form.fourMatchPrize),
    threeMatchPrize: Number(form.threeMatchPrize),
  })

  const handleSaveConfig = async () => {
    setState((current) => ({ ...current, saving: true, message: '', type: '' }))

    try {
      const response = await adminApi.patch('/admins/draws/current', buildPayload())
      applyDrawData(response.data?.data, 'Draw configuration saved successfully.', 'success')
    } catch (error) {
      setState((current) => ({
        ...current,
        saving: false,
        message: error.response?.data?.message || 'Unable to save draw configuration right now.',
        type: 'error',
      }))
    }
  }

  const handleRunSimulation = async () => {
    setState((current) => ({ ...current, simulating: true, message: '', type: '' }))

    try {
      const response = await adminApi.post('/admins/draws/current/simulate', {
        ...buildPayload(),
        simulationRuns: Number(form.simulationRuns),
      })
      applyDrawData(response.data?.data, 'Simulation completed successfully.', 'success')
    } catch (error) {
      setState((current) => ({
        ...current,
        simulating: false,
        message: error.response?.data?.message || 'Unable to run the simulation right now.',
        type: 'error',
      }))
    }
  }

  const handlePublish = async () => {
    if (hasPendingConfigChanges(draw, form)) {
      setState((current) => ({
        ...current,
        message: 'Save or simulate the latest draw settings before publishing official results.',
        type: 'error',
      }))
      return
    }

    setState((current) => ({ ...current, publishing: true, message: '', type: '' }))

    try {
      const response = await adminApi.post('/admins/draws/current/publish')
      applyDrawData(response.data?.data, 'Official draw results published successfully.', 'success')
    } catch (error) {
      setState((current) => ({
        ...current,
        publishing: false,
        message: error.response?.data?.message || 'Unable to publish draw results right now.',
        type: 'error',
      }))
    }
  }

  const activeResult = draw?.status === 'published' ? draw?.publishedResult : draw?.simulation
  const isPublished = draw?.status === 'published'

  return (
    <AdminPageShell
      title="Draw Management"
      description="Configure the monthly draw, simulate outcomes against player scores, and publish official results when the draw is ready."
    >
      <AdminMessageBanner state={state} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Draw Month" value={formatMonthLabel(draw?.drawMonth)} helper="Monthly cadence is enforced one draw at a time." />
        <StatCard label="Status" value={formatStatus(draw?.status)} helper={isPublished ? 'Official results are now locked for this month.' : 'Simulation remains private until you publish.'} />
        <StatCard label="Carry Over" value={formatCurrency(draw?.carryOverFromPrevious)} helper="Unused 5-match jackpot rolls into this month." />
        <StatCard
          label="5-Match Rollover"
          value={formatCurrency(isPublished ? draw?.rolloverToNextMonth : activeResult?.rolloverToNextMonth)}
          helper="If there is no 5-match winner, this amount advances to next month."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={`${adminPanelClass} space-y-6`}>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Draw Logic</p>
            <p className="mt-3 text-sm text-slate-300">Support for 5-number, 4-number, and 3-number matches is built into the monthly draw engine.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => handleFieldChange('logicMode', 'random')}
              disabled={isPublished}
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                form.logicMode === 'random' ? 'border-amber-300/40 bg-amber-300/10' : 'border-white/10 bg-white/5'
              } ${isPublished ? 'cursor-not-allowed opacity-70' : ''}`}
            >
              <p className="text-sm font-semibold text-white">Random Generation</p>
              <p className="mt-1 text-xs text-slate-300">Standard lottery-style draw with unique numbers.</p>
            </button>

            <button
              type="button"
              onClick={() => handleFieldChange('logicMode', 'algorithmic')}
              disabled={isPublished}
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                form.logicMode === 'algorithmic' ? 'border-amber-300/40 bg-amber-300/10' : 'border-white/10 bg-white/5'
              } ${isPublished ? 'cursor-not-allowed opacity-70' : ''}`}
            >
              <p className="text-sm font-semibold text-white">Algorithmic Weighting</p>
              <p className="mt-1 text-xs text-slate-300">Bias results toward the most or least frequent user scores.</p>
            </button>
          </div>

          {form.logicMode === 'algorithmic' ? (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Algorithm Bias</label>
              <select
                value={form.algorithmicPreference}
                onChange={(event) => handleFieldChange('algorithmicPreference', event.target.value)}
                disabled={isPublished}
                className={adminInputClass}
              >
                <option value="most_frequent" className="bg-slate-900 text-white">
                  Most Frequent User Scores
                </option>
                <option value="least_frequent" className="bg-slate-900 text-white">
                  Least Frequent User Scores
                </option>
              </select>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">5-Number Match</span>
              <input
                type="number"
                min="0"
                value={form.fiveMatchJackpot}
                onChange={(event) => handleFieldChange('fiveMatchJackpot', event.target.value)}
                disabled={isPublished}
                className={adminInputClass}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">4-Number Match</span>
              <input
                type="number"
                min="0"
                value={form.fourMatchPrize}
                onChange={(event) => handleFieldChange('fourMatchPrize', event.target.value)}
                disabled={isPublished}
                className={adminInputClass}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">3-Number Match</span>
              <input
                type="number"
                min="0"
                value={form.threeMatchPrize}
                onChange={(event) => handleFieldChange('threeMatchPrize', event.target.value)}
                disabled={isPublished}
                className={adminInputClass}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={state.loading || state.saving || isPublished}
              className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state.saving ? 'Saving...' : 'Save Configuration'}
            </button>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-xs font-medium uppercase tracking-[0.2em] text-slate-300">
              Cadence: Monthly
            </div>
          </div>
        </div>

        <div className={`${adminPanelClass} space-y-6`}>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Simulation</p>
            <p className="mt-3 text-sm text-slate-300">Run a private pre-analysis sweep before the official publish step.</p>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Simulation Runs</span>
            <input
              type="number"
              min="1"
              max="500"
              value={form.simulationRuns}
              onChange={(event) => handleFieldChange('simulationRuns', event.target.value)}
              disabled={isPublished}
              className={adminInputClass}
            />
          </label>

          <button
            type="button"
            onClick={handleRunSimulation}
            disabled={state.loading || state.simulating || isPublished}
            className="rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-6 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state.simulating ? 'Running Simulation...' : 'Run Simulation'}
          </button>

          {draw?.simulation ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">Latest Preview Numbers</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {draw.simulation.winningNumbers?.map((number) => (
                    <NumberPill key={`sim-${number}`} value={number} />
                  ))}
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  Eligible players: {draw.simulation.eligiblePlayers || 0}. Five-match hit rate across runs: {draw.simulation.analysis?.fiveMatchHitRate || 0}%.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <StatCard label="Avg 3-Match" value={draw.simulation.analysis?.averageMatchCounts?.three ?? 0} />
                <StatCard label="Avg 4-Match" value={draw.simulation.analysis?.averageMatchCounts?.four ?? 0} />
                <StatCard label="Avg 5-Match" value={draw.simulation.analysis?.averageMatchCounts?.five ?? 0} />
              </div>

              <FrequencyList
                title="User Score Weighting"
                items={draw.simulation.topScoreFrequencies}
                helper={form.logicMode === 'algorithmic' ? 'These scores influence algorithmic weighting.' : 'These are the current player score frequencies.'}
              />

              <FrequencyList
                title="Most Common Simulated Winning Numbers"
                items={draw.simulation.analysis?.mostCommonWinningNumbers}
                helper="These numbers appeared most often across the simulation runs."
              />
            </div>
          ) : (
            <p className="text-sm text-slate-300">No simulation has been run for this month yet.</p>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className={`${adminPanelClass} space-y-6`}>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Publishing</p>
            <p className="mt-3 text-sm text-slate-300">Only admins can publish official results, and each month can be published once.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-semibold text-white">{isPublished ? 'Official Winning Numbers' : 'Current Candidate Numbers'}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(activeResult?.winningNumbers || []).map((number) => (
                <NumberPill key={`official-${number}`} value={number} />
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-300">
              {isPublished
                ? `Published winners are now available for this ${formatMonthLabel(draw?.drawMonth)} cycle.`
                : 'Publish the latest preview when you are satisfied with the simulation outcome.'}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="3-Match Winners" value={activeResult?.matchCounts?.three ?? 0} helper={formatCurrency(activeResult?.payout?.three)} />
            <StatCard label="4-Match Winners" value={activeResult?.matchCounts?.four ?? 0} helper={formatCurrency(activeResult?.payout?.four)} />
            <StatCard label="5-Match Winners" value={activeResult?.matchCounts?.five ?? 0} helper={formatCurrency(activeResult?.payout?.five)} />
          </div>

          <button
            type="button"
            onClick={handlePublish}
            disabled={state.loading || state.publishing || isPublished}
            className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state.publishing ? 'Publishing...' : isPublished ? 'Results Published' : 'Publish Results'}
          </button>
        </div>

        <div className={`${adminPanelClass} space-y-6`}>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Winner Preview</p>
            <p className="mt-3 text-sm text-slate-300">This panel surfaces the current month’s 3-match, 4-match, and 5-match outcomes.</p>
          </div>

          <WinnersPreview winners={activeResult?.winners} />
        </div>
      </section>
    </AdminPageShell>
  )
}

export default AdminDrawsPage
