import { useEffect, useState } from 'react'
import { adminApi } from '../utils/api'
import AdminPageShell, { AdminMessageBanner, adminInputClass, adminPanelClass } from './AdminPageShell'

const emptyForm = { name: '', description: '', website: '', totalDonations: '', logo: null }

const AdminCharitiesPage = () => {
  const [charities, setCharities] = useState([])
  const [editingCharityId, setEditingCharityId] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [state, setState] = useState({ message: '', type: '', loading: true, saving: false })

  const loadCharities = async () => {
    setState((prev) => ({ ...prev, loading: true }))
    try {
      const response = await adminApi.get('/admins/charities')
      setCharities(response.data?.data || [])
      setState({ message: '', type: '', loading: false, saving: false })
    } catch (error) {
      setState({
        message: error.response?.data?.message || 'Unable to load charities right now.',
        type: 'error',
        loading: false,
        saving: false,
      })
    }
  }

  useEffect(() => {
    loadCharities()
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setState((prev) => ({ ...prev, saving: true, message: '', type: '' }))

    try {
      const formData = new FormData()
      formData.append('name', form.name)
      formData.append('description', form.description)
      formData.append('website', form.website)
      formData.append('totalDonations', form.totalDonations)
      if (form.logo) formData.append('logo', form.logo)

      if (editingCharityId) {
        await adminApi.patch(`/admins/charities/${editingCharityId}`, formData)
      } else {
        await adminApi.post('/admins/charities', formData)
      }

      await loadCharities()
      setForm(emptyForm)
      setEditingCharityId('')
      setState((prev) => ({ ...prev, saving: false, message: editingCharityId ? 'Charity updated successfully.' : 'Charity created successfully.', type: 'success' }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        saving: false,
        message: error.response?.data?.message || 'Unable to save charity right now.',
        type: 'error',
      }))
    }
  }

  const handleDelete = async (charityId) => {
    try {
      await adminApi.delete(`/admins/charities/${charityId}`)
      await loadCharities()
      if (editingCharityId === charityId) {
        setEditingCharityId('')
        setForm(emptyForm)
      }
    } catch (error) {
      setState({
        message: error.response?.data?.message || 'Unable to delete charity right now.',
        type: 'error',
        loading: false,
        saving: false,
      })
    }
  }

  return (
    <AdminPageShell
      title="Charity Management"
      description="Add, edit, and delete charities while keeping their content and media organized."
    >
      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className={adminPanelClass}>
          <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">{editingCharityId ? 'Edit Charity' : 'Add Charity'}</p>
          <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
            <input type="text" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Charity name" className={adminInputClass} />
            <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Description" rows={4} className={adminInputClass} />
            <input type="url" value={form.website} onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))} placeholder="Website" className={adminInputClass} />
            <input type="number" value={form.totalDonations} onChange={(event) => setForm((prev) => ({ ...prev, totalDonations: event.target.value }))} placeholder="Total donations" className={adminInputClass} />
            <input type="file" onChange={(event) => setForm((prev) => ({ ...prev, logo: event.target.files?.[0] || null }))} accept="image/png,image/jpeg,image/webp" className="theme-input w-full rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-amber-300 file:px-4 file:py-2 file:font-semibold file:text-slate-950" />
            <AdminMessageBanner state={state} />
            <div className="flex gap-3">
              <button type="submit" disabled={state.saving} className="rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-6 py-3 text-sm font-semibold text-slate-950">
                {state.saving ? 'Saving...' : editingCharityId ? 'Update Charity' : 'Create Charity'}
              </button>
              {editingCharityId ? (
                <button type="button" onClick={() => { setEditingCharityId(''); setForm(emptyForm) }} className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white">
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className={adminPanelClass}>
          <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Charity Directory</p>
          <div className="mt-6 space-y-4">
            {state.loading ? (
              <p className="text-sm text-slate-300">Loading charities...</p>
            ) : charities.length ? (
              charities.map((charity) => (
                <div key={charity._id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-white">{charity.name}</p>
                      <p className="mt-2 text-sm text-slate-300">{charity.description || 'No description yet.'}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-400">Total donations: {charity.totalDonations || 0}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCharityId(charity._id)
                          setForm({
                            name: charity.name || '',
                            description: charity.description || '',
                            website: charity.website || '',
                            totalDonations: charity.totalDonations || '',
                            logo: null,
                          })
                        }}
                        className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white"
                      >
                        Edit
                      </button>
                      <button type="button" onClick={() => handleDelete(charity._id)} className="rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-xs font-semibold text-rose-200">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-300">No charities available yet.</p>
            )}
          </div>
        </div>
      </section>
    </AdminPageShell>
  )
}

export default AdminCharitiesPage
