import { useEffect, useState } from 'react'
import { adminApi } from '../utils/api'
import { useAdmin } from '../context/AdminContext'
import { useTheme } from '../context/ThemeContext'
import AdminPageShell, { AdminMessageBanner, adminInputClass, adminPanelClass } from './AdminPageShell'

const permissionLabels = [
  ['manageUsers', 'Manage Users'],
  ['manageEvents', 'Manage Events'],
  ['managePayments', 'Manage Payments'],
  ['manageDonations', 'Manage Donations'],
]

const AdminSettingsPage = () => {
  const { currentAdmin, saveAdminSession } = useAdmin()
  const { theme, setTheme } = useTheme()
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    handicap: '',
    avatar: null,
  })
  const [profileState, setProfileState] = useState({ saving: false, message: '', type: '' })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordState, setPasswordState] = useState({ saving: false, message: '', type: '' })

  useEffect(() => {
    const adminUser = currentAdmin?.userId

    if (!adminUser) return

    setProfileForm({
      name: adminUser.name || '',
      email: adminUser.email || '',
      handicap: adminUser.handicap ?? '',
      avatar: null,
    })
  }, [currentAdmin])

  const handleProfileChange = (event) => {
    const { name, value, files } = event.target
    setProfileForm((prev) => ({ ...prev, [name]: name === 'avatar' ? files?.[0] || null : value }))
  }

  const handlePasswordChange = (event) => {
    const { name, value } = event.target
    setPasswordForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleProfileSubmit = async (event) => {
    event.preventDefault()
    setProfileState({ saving: true, message: '', type: '' })

    try {
      const formData = new FormData()
      formData.append('name', profileForm.name)
      formData.append('email', profileForm.email)
      formData.append('handicap', profileForm.handicap)

      if (profileForm.avatar) {
        formData.append('avatar', profileForm.avatar)
      }

      const response = await adminApi.patch('/admins/updateProfile', formData)
      const payload = response.data?.data || {}
      const updatedAdmin = payload.admin || payload

      if (updatedAdmin) {
        saveAdminSession(updatedAdmin)
      }

      setProfileForm((prev) => ({ ...prev, avatar: null }))
      setProfileState({
        saving: false,
        message: 'Admin profile updated successfully.',
        type: 'success',
      })
    } catch (error) {
      setProfileState({
        saving: false,
        message: error.response?.data?.message || 'Unable to update admin profile right now.',
        type: 'error',
      })
    }
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordState({ saving: false, message: 'New password and confirm password must match.', type: 'error' })
      return
    }

    setPasswordState({ saving: true, message: '', type: '' })

    try {
      await adminApi.patch('/admins/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordState({ saving: false, message: 'Admin password updated successfully.', type: 'success' })
    } catch (error) {
      setPasswordState({
        saving: false,
        message: error.response?.data?.message || 'Unable to update admin password right now.',
        type: 'error',
      })
    }
  }

  const adminUser = currentAdmin?.userId

  return (
    <AdminPageShell
      title="Admin Settings"
      description="Manage your admin account details, avatar, password, theme, and review your active platform permissions."
    >
      {currentAdmin ? (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className={`${adminPanelClass} space-y-6`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Admin Account</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Profile details</h2>
              </div>
              {adminUser?.avatar ? (
                <img
                  src={adminUser.avatar}
                  alt={adminUser.name || 'Admin avatar'}
                  className="h-16 w-16 rounded-full border border-amber-300/25 object-cover"
                />
              ) : (
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/25 bg-amber-300/10 text-lg font-semibold uppercase text-amber-100">
                  {(adminUser?.name || adminUser?.email || 'A')
                    .split(' ')
                    .map((word) => word[0])
                    .join('')
                    .slice(0, 2)}
                </div>
              )}
            </div>

            <form onSubmit={handleProfileSubmit} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <input type="text" name="name" value={profileForm.name} onChange={handleProfileChange} placeholder="Full name" className={adminInputClass} />
                <input type="email" name="email" value={profileForm.email} onChange={handleProfileChange} placeholder="Email address" className={adminInputClass} />
                <input type="number" name="handicap" value={profileForm.handicap} onChange={handleProfileChange} placeholder="Handicap" className={adminInputClass} />
              </div>
              <input type="file" name="avatar" onChange={handleProfileChange} accept="image/png,image/jpeg,image/webp" className="theme-input w-full rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-amber-300 file:px-4 file:py-2 file:font-semibold file:text-slate-950" />
              <AdminMessageBanner state={profileState} />
              <button type="submit" disabled={profileState.saving} className="inline-flex w-fit rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-6 py-3 text-sm font-semibold text-slate-950">
                {profileState.saving ? 'Saving...' : 'Save Admin Profile'}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <section className={`${adminPanelClass} space-y-5`}>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Appearance</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Theme</h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`rounded-2xl border px-4 py-4 text-left ${theme === 'dark' ? 'border-amber-300/40 bg-amber-300/10' : 'border-white/10 bg-white/5'}`}
                >
                  <p className="text-sm font-semibold text-white">Dark Theme</p>
                  <p className="mt-1 text-xs text-slate-300">Focused control-room look.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`rounded-2xl border px-4 py-4 text-left ${theme === 'light' ? 'border-amber-300/40 bg-amber-300/10' : 'border-white/10 bg-white/5'}`}
                >
                  <p className="text-sm font-semibold text-white">Light Theme</p>
                  <p className="mt-1 text-xs text-slate-300">Brighter workspace for daytime use.</p>
                </button>
              </div>
            </section>

            <section className={`${adminPanelClass} space-y-5`}>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Security</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Change password</h2>
              </div>

              <form onSubmit={handlePasswordSubmit} className="grid gap-4">
                <input type="password" name="currentPassword" value={passwordForm.currentPassword} onChange={handlePasswordChange} placeholder="Current password" className={adminInputClass} />
                <input type="password" name="newPassword" value={passwordForm.newPassword} onChange={handlePasswordChange} placeholder="New password" className={adminInputClass} />
                <input type="password" name="confirmPassword" value={passwordForm.confirmPassword} onChange={handlePasswordChange} placeholder="Confirm new password" className={adminInputClass} />
                <AdminMessageBanner state={passwordState} />
                <button type="submit" disabled={passwordState.saving} className="inline-flex w-fit rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white">
                  {passwordState.saving ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </section>

            <section className={adminPanelClass}>
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Permissions</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Active admin access</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {permissionLabels.map(([key, label]) => (
                  <div key={key} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="mt-2 text-sm text-slate-300">
                      {currentAdmin.permissions?.[key] ? 'Enabled for this admin account' : 'Not enabled for this admin account'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      ) : null}
    </AdminPageShell>
  )
}

export default AdminSettingsPage
