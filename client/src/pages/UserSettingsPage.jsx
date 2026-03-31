import { useEffect, useState } from 'react'
import { userApi } from '../utils/api'
import { useUser } from '../context/UserContext'
import { useTheme } from '../context/ThemeContext'
import UserPageShell, { MessageBanner, inputClass, panelClass } from './UserPageShell'

const UserSettingsPage = () => {
  const { currentUser, refreshUserSession } = useUser()
  const { theme, setTheme } = useTheme()
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    handicap: '',
    avatar: null,
    payoutBeneficiaryName: '',
    payoutEmail: '',
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [profileState, setProfileState] = useState({ saving: false, message: '', type: '' })
  const [passwordState, setPasswordState] = useState({ saving: false, message: '', type: '' })

  useEffect(() => {
    if (!currentUser) return

    setProfileForm({
      name: currentUser.name || '',
      email: currentUser.email || '',
      handicap: currentUser.handicap ?? '',
      avatar: null,
      payoutBeneficiaryName: currentUser.payoutDetails?.beneficiaryName || currentUser.name || '',
      payoutEmail: currentUser.payoutDetails?.email || currentUser.email || '',
    })
  }, [currentUser])

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
      formData.append('payoutBeneficiaryName', profileForm.payoutBeneficiaryName)
      formData.append('payoutEmail', profileForm.payoutEmail)

      if (profileForm.avatar) {
        formData.append('avatar', profileForm.avatar)
      }

      const response = await userApi.patch('/users/updateProfile', formData)

      await refreshUserSession()
      setProfileForm((prev) => ({ ...prev, avatar: null }))
      setProfileState({
        saving: false,
        message: response.data?.message || 'Profile updated successfully.',
        type: 'success',
      })
    } catch (error) {
      setProfileState({
        saving: false,
        message: error.response?.data?.message || 'Unable to update profile right now.',
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
      await userApi.patch('/users/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordState({ saving: false, message: 'Password updated successfully.', type: 'success' })
    } catch (error) {
      setPasswordState({
        saving: false,
        message: error.response?.data?.message || 'Unable to update password right now.',
        type: 'error',
      })
    }
  }

  return (
    <UserPageShell
      title="Profile Settings"
      description="Manage your profile, security, and appearance from one clean settings page."
    >
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className={`${panelClass} space-y-6`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Account Details</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Profile and payout setup</h2>
            </div>
            {currentUser?.avatar ? (
              <img src={currentUser.avatar} alt={currentUser.name || 'User avatar'} className="h-16 w-16 rounded-full border border-emerald-400/25 object-cover" />
            ) : (
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10 text-lg font-semibold uppercase text-emerald-200">
                {(currentUser?.name || currentUser?.email || 'U')
                  .split(' ')
                  .map((word) => word[0])
                  .join('')
                  .slice(0, 2)}
              </div>
            )}
          </div>

          <form onSubmit={handleProfileSubmit} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <input type="text" name="name" value={profileForm.name} onChange={handleProfileChange} placeholder="Full name" className={inputClass} />
              <input type="email" name="email" value={profileForm.email} onChange={handleProfileChange} placeholder="Email address" className={inputClass} />
              <input type="number" name="handicap" value={profileForm.handicap} onChange={handleProfileChange} placeholder="Handicap" className={inputClass} />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Winner Payout Details</p>
              <p className="mt-2 text-sm text-slate-300">
                Stripe will use these details to create or update your payout recipient profile before prize money is sent.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <input
                  type="text"
                  name="payoutBeneficiaryName"
                  value={profileForm.payoutBeneficiaryName}
                  onChange={handleProfileChange}
                  placeholder="Beneficiary name"
                  className={inputClass}
                />
                <input
                  type="email"
                  name="payoutEmail"
                  value={profileForm.payoutEmail}
                  onChange={handleProfileChange}
                  placeholder="Payout email"
                  className={`${inputClass} sm:col-span-2`}
                />
              </div>
            </div>
            <input type="file" name="avatar" onChange={handleProfileChange} accept="image/png,image/jpeg,image/webp" className="theme-input w-full rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-amber-300 file:px-4 file:py-2 file:font-semibold file:text-slate-950" />
            <MessageBanner state={profileState} />
            <button type="submit" disabled={profileState.saving} className="inline-flex w-fit items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-6 py-3 text-sm font-semibold text-slate-950">
              {profileState.saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <section className={`${panelClass} space-y-5`}>
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
                <p className="mt-1 text-xs text-slate-300">High contrast and cinematic look.</p>
              </button>
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`rounded-2xl border px-4 py-4 text-left ${theme === 'light' ? 'border-amber-300/40 bg-amber-300/10' : 'border-white/10 bg-white/5'}`}
              >
                <p className="text-sm font-semibold text-white">Light Theme</p>
                <p className="mt-1 text-xs text-slate-300">Bright dashboard for daytime use.</p>
              </button>
            </div>
          </section>

          <section className={`${panelClass} space-y-5`}>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-300">Security</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Change password</h2>
            </div>

            <form onSubmit={handlePasswordSubmit} className="grid gap-4">
              <input type="password" name="currentPassword" value={passwordForm.currentPassword} onChange={handlePasswordChange} placeholder="Current password" className={inputClass} />
              <input type="password" name="newPassword" value={passwordForm.newPassword} onChange={handlePasswordChange} placeholder="New password" className={inputClass} />
              <input type="password" name="confirmPassword" value={passwordForm.confirmPassword} onChange={handlePasswordChange} placeholder="Confirm new password" className={inputClass} />
              <MessageBanner state={passwordState} />
              <button type="submit" disabled={passwordState.saving} className="inline-flex w-fit items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white">
                {passwordState.saving ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </section>
        </div>
      </section>
    </UserPageShell>
  )
}

export default UserSettingsPage
