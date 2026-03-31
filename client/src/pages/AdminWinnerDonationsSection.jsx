import { adminPanelClass } from './AdminPageShell'

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const AdminWinnerDonationsSection = ({ donations = [] }) => (
  <section className={adminPanelClass}>
    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Winner Charity Contributions</p>
    <h2 className="mt-3 text-2xl font-semibold text-white">Recent charity deductions from winning payouts</h2>

    <div className="mt-5 overflow-x-auto">
      {donations.length ? (
        <table className="min-w-full text-left text-sm text-slate-300">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-[0.2em] text-slate-400">
              <th className="pb-3 pr-4 font-semibold">Name</th>
              <th className="pb-3 pr-4 font-semibold">Amount</th>
              <th className="pb-3 font-semibold">Charity Name</th>
            </tr>
          </thead>
          <tbody>
            {donations.map((donation) => (
              <tr key={donation._id} className="border-b border-white/5">
                <td className="py-3 pr-4">{donation.userName || 'Unknown user'}</td>
                <td className="py-3 pr-4">{formatCurrency(donation.amount)}</td>
                <td className="py-3">{donation.charityName || 'Unknown charity'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-slate-300">No winner charity contributions have been recorded yet.</p>
      )}
    </div>
  </section>
)

export default AdminWinnerDonationsSection
