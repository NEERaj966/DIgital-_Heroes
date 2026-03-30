import { useEffect, useState } from 'react'
import { adminApi } from '../utils/api'
import AdminPageShell, { adminPanelClass } from './AdminPageShell'

const AdminReportsPage = () => {
  const [reports, setReports] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadReports = async () => {
      try {
        const response = await adminApi.get('/admins/reports')
        setReports(response.data?.data || null)
        setError('')
      } catch (fetchError) {
        setError(fetchError.response?.data?.message || 'Unable to load reports right now.')
      }
    }

    loadReports()
  }, [])

  const reportCards = reports
    ? [
        ['Total Users', reports.totalUsers],
        ['Total Prize Pool', `₹${reports.totalPrizePool}`],
        ['Charity Contribution Totals', `₹${reports.charityContributionTotals}`],
        ['Total Scores', reports.drawStatistics?.totalScores],
        ['Pending Winner Proofs', reports.drawStatistics?.proofPendingCount],
        ['Completed Payouts', reports.drawStatistics?.payoutsCompleted],
      ]
    : []

  return (
    <AdminPageShell
      title="Reports & Analytics"
      description="Track total users, prize pool, charity contribution totals, and draw statistics."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {error ? <div className={adminPanelClass}>{error}</div> : null}
        {reportCards.map(([label, value]) => (
          <div key={label} className={adminPanelClass}>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-white">{value ?? 0}</p>
          </div>
        ))}
      </section>
    </AdminPageShell>
  )
}

export default AdminReportsPage
