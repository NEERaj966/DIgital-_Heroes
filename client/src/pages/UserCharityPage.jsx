import { useEffect, useState } from 'react'
import { userApi } from '../utils/api'
import { useUser } from '../context/UserContext'
import UserPageShell, { MessageBanner, inputClass, panelClass } from './UserPageShell'

const UserCharityPage = () => {
  const { currentUser, refreshUserSession } = useUser()
  const [charities, setCharities] = useState([])
  const [form, setForm] = useState({ charityId: '', contributionPercentage: 10 })
  const [state, setState] = useState({ loading: true, saving: false, message: '', type: '' })

  useEffect(() => {
    if (!currentUser) return

    setForm({
      charityId: currentUser.preferredCharity?._id || '',
      contributionPercentage: currentUser.charityContributionPercentage ?? 10,
    })
  }, [currentUser])

  useEffect(() => {
    const loadCharities = async () => {
      setState({ loading: true, saving: false, message: '', type: '' })
      try {
        const response = await userApi.get('/users/charities')
        setCharities(response.data?.data || [])
        setState({ loading: false, saving: false, message: '', type: '' })
      } catch (error) {
        setState({
          loading: false,
          saving: false,
          message: error.response?.data?.message || 'Unable to load charities right now.',
          type: 'error',
        })
      }
    }

    loadCharities()
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: name === 'contributionPercentage' ? Number(value) : value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setState((prev) => ({ ...prev, saving: true, message: '', type: '' }))
    try {
      await userApi.patch('/users/charity-preference', form)
      await refreshUserSession()
      setState((prev) => ({ ...prev, saving: false, message: 'Charity preference updated.', type: 'success' }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        saving: false,
        message: error.response?.data?.message || 'Unable to save charity preference right now.',
        type: 'error',
      }))
    }
  }

  return (
    <UserPageShell
      title="Charity Choice"
      description="Choose your charity recipient and set the contribution percentage from this single, simple page."
    >
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className={panelClass}>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <select name="charityId" value={form.charityId} onChange={handleChange} className={inputClass}>
              <option value="" className="bg-slate-900 text-white">Choose a charity</option>
              {charities.map((charity) => (
                <option key={charity._id} value={charity._id} className="bg-slate-900 text-white">
                  {charity.name}
                </option>
              ))}
            </select>
            <div>
              <input type="range" name="contributionPercentage" min="10" max="100" value={form.contributionPercentage} onChange={handleChange} className="w-full accent-amber-400" />
              <div className="mt-2 flex items-center justify-between text-sm text-slate-300">
                <span>Minimum 10%</span>
                <span>{form.contributionPercentage}% selected</span>
              </div>
            </div>
            <MessageBanner state={state} />
            <button type="submit" disabled={state.saving || state.loading} className="inline-flex w-fit items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-6 py-3 text-sm font-semibold text-slate-950">
              {state.saving ? 'Saving...' : 'Save Charity'}
            </button>
          </form>
        </div>

        <div className={panelClass}>
          {state.loading ? (
            <p className="text-sm text-slate-300">Loading charities...</p>
          ) : charities.length ? (
            <div className="space-y-4">
              {charities.map((charity) => {
                const isSelected = charity._id === currentUser?.preferredCharity?._id
                return (
                  <div key={charity._id} className={`rounded-2xl border p-4 ${isSelected ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-white/5'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-white">{charity.name}</p>
                        <p className="mt-2 text-sm text-slate-300">{charity.description || 'Description coming soon.'}</p>
                      </div>
                      {isSelected ? <span className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-semibold uppercase text-slate-950">Selected</span> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-300">No charities listed yet.</p>
          )}
        </div>
      </section>
    </UserPageShell>
  )
}

export default UserCharityPage
