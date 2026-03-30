import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '../utils/api'
import AdminPageShell, { AdminMessageBanner, adminInputClass, adminPanelClass } from './AdminPageShell'

const AdminUsersPage = () => {
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedUserScores, setSelectedUserScores] = useState([])
  const [scoreState, setScoreState] = useState({ message: '', type: '', loading: false })
  const [pageState, setPageState] = useState({ message: '', type: '', loading: true, saving: false })
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    handicap: '',
    subscriptionStatus: 'active',
    subscriptionPlan: 'regular-monthly',
    payoutStatus: '',
  })

  const loadUsers = useCallback(async () => {
    setPageState((prev) => ({ ...prev, loading: true }))
    try {
      const response = await adminApi.get('/admins/users')
      const nextUsers = response.data?.data || []
      setUsers(nextUsers)
      setPageState({ message: '', type: '', loading: false, saving: false })

      if (!selectedUserId && nextUsers[0]?._id) {
        setSelectedUserId(nextUsers[0]._id)
      }
    } catch (error) {
      setPageState({
        message: error.response?.data?.message || 'Unable to load users right now.',
        type: 'error',
        loading: false,
        saving: false,
      })
    }
  }, [selectedUserId])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const selectedUser = users.find((user) => user._id === selectedUserId)

  useEffect(() => {
    if (!selectedUser) return

    setEditForm({
      name: selectedUser.name || '',
      email: selectedUser.email || '',
      handicap: selectedUser.handicap ?? '',
      subscriptionStatus: selectedUser.subscription?.status || 'inactive',
      subscriptionPlan: selectedUser.subscription?.planCode || 'regular-monthly',
      payoutStatus: selectedUser.payoutStatus || '',
    })
  }, [selectedUserId, selectedUser])

  useEffect(() => {
    if (!selectedUserId) return

    const loadScores = async () => {
      setScoreState({ message: '', type: '', loading: true })
      try {
        const response = await adminApi.get(`/admins/users/${selectedUserId}/scores`)
        setSelectedUserScores(response.data?.data || [])
        setScoreState({ message: '', type: '', loading: false })
      } catch (error) {
        setSelectedUserScores([])
        setScoreState({
          message: error.response?.data?.message || 'Unable to load scores right now.',
          type: 'error',
          loading: false,
        })
      }
    }

    loadScores()
  }, [selectedUserId])

  const handleUserSave = async (event) => {
    event.preventDefault()
    if (!selectedUserId) return

    setPageState((prev) => ({ ...prev, saving: true, message: '', type: '' }))
    try {
      await adminApi.patch(`/admins/users/${selectedUserId}`, editForm)
      await loadUsers()
      setPageState((prev) => ({ ...prev, saving: false, message: 'User updated successfully.', type: 'success' }))
    } catch (error) {
      setPageState((prev) => ({
        ...prev,
        saving: false,
        message: error.response?.data?.message || 'Unable to update user right now.',
        type: 'error',
      }))
    }
  }

  const handleScoreUpdate = async (scoreId, scoreValue, playedAt) => {
    try {
      await adminApi.patch(`/admins/scores/${scoreId}`, {
        stablefordScore: scoreValue,
        playedAt,
      })
      const response = await adminApi.get(`/admins/users/${selectedUserId}/scores`)
      setSelectedUserScores(response.data?.data || [])
      setScoreState({ message: 'Score updated successfully.', type: 'success', loading: false })
    } catch (error) {
      setScoreState({
        message: error.response?.data?.message || 'Unable to update score right now.',
        type: 'error',
        loading: false,
      })
    }
  }

  return (
    <AdminPageShell
      title="User Management"
      description="View and edit user profiles, adjust golf scores, and manage subscription details from one admin screen."
    >
      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className={adminPanelClass}>
          <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Users</p>
          <div className="mt-6 space-y-3">
            {pageState.loading ? (
              <p className="text-sm text-slate-300">Loading users...</p>
            ) : users.length ? (
              users.map((user) => (
                <button
                  key={user._id}
                  type="button"
                  onClick={() => setSelectedUserId(user._id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${selectedUserId === user._id ? 'border-amber-300/40 bg-amber-300/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                >
                  <p className="text-sm font-semibold text-white">{user.name}</p>
                  <p className="mt-1 text-xs text-slate-300">{user.email}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-400">
                    {user.subscription?.planCode || 'no-plan'} • {user.subscription?.status || 'inactive'}
                  </p>
                </button>
              ))
            ) : (
              <p className="text-sm text-slate-300">No users found.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <section className={adminPanelClass}>
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Edit User</p>
            {selectedUser ? (
              <form onSubmit={handleUserSave} className="mt-6 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <input type="text" value={editForm.name} onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Name" className={adminInputClass} />
                  <input type="email" value={editForm.email} onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Email" className={adminInputClass} />
                  <input type="number" value={editForm.handicap} onChange={(event) => setEditForm((prev) => ({ ...prev, handicap: event.target.value }))} placeholder="Handicap" className={adminInputClass} />
                  <select value={editForm.subscriptionPlan} onChange={(event) => setEditForm((prev) => ({ ...prev, subscriptionPlan: event.target.value }))} className={adminInputClass}>
                    <option value="regular-monthly" className="bg-slate-900 text-white">regular-monthly</option>
                    <option value="popular-monthly" className="bg-slate-900 text-white">popular-monthly</option>
                    <option value="yearly" className="bg-slate-900 text-white">yearly</option>
                  </select>
                  <select value={editForm.subscriptionStatus} onChange={(event) => setEditForm((prev) => ({ ...prev, subscriptionStatus: event.target.value }))} className={adminInputClass}>
                    <option value="active" className="bg-slate-900 text-white">active</option>
                    <option value="inactive" className="bg-slate-900 text-white">inactive</option>
                  </select>
                  <select value={editForm.payoutStatus} onChange={(event) => setEditForm((prev) => ({ ...prev, payoutStatus: event.target.value }))} className={adminInputClass}>
                    <option value="" className="bg-slate-900 text-white">not_applicable</option>
                    <option value="pending" className="bg-slate-900 text-white">pending</option>
                    <option value="paid" className="bg-slate-900 text-white">paid</option>
                  </select>
                </div>
                <p className="text-sm text-slate-300">Sign-in method: {selectedUser.authProvider === 'google' ? 'Google' : 'Email and password'}</p>
                <AdminMessageBanner state={pageState} />
                <button type="submit" disabled={pageState.saving} className="inline-flex w-fit rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-6 py-3 text-sm font-semibold text-slate-950">
                  {pageState.saving ? 'Saving...' : 'Save User'}
                </button>
              </form>
            ) : (
              <p className="mt-4 text-sm text-slate-300">Select a user to edit profile and subscription details.</p>
            )}
          </section>

          <section className={adminPanelClass}>
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Edit Golf Scores</p>
            <AdminMessageBanner state={scoreState} />
            {scoreState.loading ? (
              <p className="mt-4 text-sm text-slate-300">Loading user scores...</p>
            ) : selectedUserScores.length ? (
              <div className="mt-4 space-y-4">
                {selectedUserScores.map((score) => (
                  <AdminScoreRow key={score._id} score={score} onSave={handleScoreUpdate} />
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-300">No scores found for this user.</p>
            )}
          </section>
        </div>
      </section>
    </AdminPageShell>
  )
}

const AdminScoreRow = ({ score, onSave }) => {
  const [stablefordScore, setStablefordScore] = useState(score.stablefordScore)
  const [playedAt, setPlayedAt] = useState(new Date(score.playedAt).toISOString().split('T')[0])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
        <input type="number" min="1" max="45" value={stablefordScore} onChange={(event) => setStablefordScore(event.target.value)} className={adminInputClass} />
        <input type="date" value={playedAt} onChange={(event) => setPlayedAt(event.target.value)} className={adminInputClass} />
        <button type="button" onClick={() => onSave(score._id, stablefordScore, playedAt)} className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white">
          Update
        </button>
      </div>
    </div>
  )
}

export default AdminUsersPage
