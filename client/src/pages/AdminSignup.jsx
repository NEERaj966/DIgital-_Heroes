import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { adminApi } from '../utils/api'
import { useAdmin } from '../context/AdminContext'
import { useUser } from '../context/UserContext'
import GoogleAuthButton from '../componant/GoogleAuthButton'
import { decodeGoogleCredential } from '../utils/googleAuth'

const cardVariants = {
  hidden: { opacity: 0, y: 36 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

const fieldMotion = {
  rest: { scale: 1 },
  hover: { scale: 1.01, transition: { duration: 0.2 } },
}

const inputClassName =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-amber-300/70 focus:bg-white/10'

const permissionItems = [
  { key: 'manageUsers', label: 'Manage Users' },
  { key: 'manageEvents', label: 'Manage Events' },
  { key: 'managePayments', label: 'Manage Payments' },
  { key: 'manageDonations', label: 'Manage Donations' },
]

const AdminSignup = () => {
  const navigate = useNavigate()
  const { saveAdminSession } = useAdmin()
  const { clearUserSession } = useUser()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    handicap: '',
    avatar: null,
    permissions: {
      manageUsers: false,
      manageEvents: false,
      managePayments: false,
      manageDonations: false,
    },
  })
  const [state, setState] = useState({
    loading: false,
    message: '',
    type: '',
  })

  const handleChange = (event) => {
    const { name, value, files, checked, type } = event.target

    if (name in form.permissions) {
      setForm((prev) => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [name]: checked,
        },
      }))

      return
    }

    setForm((prev) => ({
      ...prev,
      [name]: type === 'file' ? files?.[0] || null : value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setState({
      loading: true,
      message: '',
      type: '',
    })

    try {
      const formData = new FormData()
      formData.append('name', form.name)
      formData.append('email', form.email)
      formData.append('password', form.password)

      if (form.handicap !== '') {
        formData.append('handicap', form.handicap)
      }

      if (form.avatar) {
        formData.append('avatar', form.avatar)
      }

      formData.append('manageUsers', String(form.permissions.manageUsers))
      formData.append('manageEvents', String(form.permissions.manageEvents))
      formData.append('managePayments', String(form.permissions.managePayments))
      formData.append('manageDonations', String(form.permissions.manageDonations))

      const response = await adminApi.post('/admins/register', formData)
      const authAdmin = response.data?.data?.admin
      const token = response.data?.data?.token

      setState({
        loading: false,
        message: response.data?.message || 'Admin account created successfully',
        type: 'success',
      })

      setForm({
        name: '',
        email: '',
        password: '',
        handicap: '',
        avatar: null,
        permissions: {
          manageUsers: false,
          manageEvents: false,
          managePayments: false,
          manageDonations: false,
        },
      })

      if (authAdmin) {
        clearUserSession()
        saveAdminSession(authAdmin, token)
      }

      navigate('/admin/profile')
    } catch (error) {
      setState({
        loading: false,
        message: error.response?.data?.message || 'Unable to create admin account right now',
        type: 'error',
      })
    }
  }

  const handleGoogleSignup = useCallback(
    async (googleToken) => {
      setState({ loading: true, message: '', type: '' })

      try {
        const googleProfile = decodeGoogleCredential(googleToken)
        const formData = new FormData()
        formData.append('googleToken', googleToken)
        formData.append('name', form.name.trim() || googleProfile.name || googleProfile.given_name || 'Admin User')

        if (form.handicap !== '') {
          formData.append('handicap', form.handicap)
        }

        if (form.avatar) {
          formData.append('avatar', form.avatar)
        }

        formData.append('manageUsers', String(form.permissions.manageUsers))
        formData.append('manageEvents', String(form.permissions.manageEvents))
        formData.append('managePayments', String(form.permissions.managePayments))
        formData.append('manageDonations', String(form.permissions.manageDonations))

        const response = await adminApi.post('/admins/google/register', formData)
        const authAdmin = response.data?.data?.admin
        const token = response.data?.data?.token

        if (authAdmin) {
          clearUserSession()
          saveAdminSession(authAdmin, token)
        }

        setState({
          loading: false,
          message: response.data?.message || 'Admin account created with Google successfully',
          type: 'success',
        })

        navigate('/admin/profile')
      } catch (error) {
        setState({
          loading: false,
          message: error.response?.data?.message || error.message || 'Unable to create admin account with Google right now',
          type: 'error',
        })
      }
    },
    [clearUserSession, form.avatar, form.handicap, form.name, form.permissions, navigate, saveAdminSession]
  )

  return (
    <motion.section
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={cardVariants}
      className="auth-card rounded-[34px] border border-white/10 p-8 sm:p-10"
    >
      <div className="mb-8 max-w-xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">
          Admin Sign Up
        </p>
        <h2 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
          Create an administrator account with platform permissions.
        </h2>
        <p className="mt-4 text-base leading-8 text-slate-300">
          Set up the admin profile, upload the avatar, and choose which permissions should be active from day one.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <motion.div whileHover="hover" initial="rest" animate="rest" variants={fieldMotion} className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-slate-200">Full Name</label>
          <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="Enter admin full name" className={inputClassName} />
        </motion.div>

        <motion.div whileHover="hover" initial="rest" animate="rest" variants={fieldMotion}>
          <label className="mb-2 block text-sm font-medium text-slate-200">Email</label>
          <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Enter admin email" className={inputClassName} />
        </motion.div>

        <motion.div whileHover="hover" initial="rest" animate="rest" variants={fieldMotion}>
          <label className="mb-2 block text-sm font-medium text-slate-200">Password</label>
          <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Create admin password" className={inputClassName} />
        </motion.div>

        <motion.div whileHover="hover" initial="rest" animate="rest" variants={fieldMotion}>
          <label className="mb-2 block text-sm font-medium text-slate-200">Handicap</label>
          <input type="number" name="handicap" value={form.handicap} onChange={handleChange} placeholder="Optional handicap" className={inputClassName} />
        </motion.div>

        <motion.div whileHover="hover" initial="rest" animate="rest" variants={fieldMotion} className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-slate-200">Avatar</label>
          <input
            type="file"
            name="avatar"
            onChange={handleChange}
            accept="image/png,image/jpeg,image/webp"
            className="w-full rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-amber-300 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
          />
        </motion.div>

        <div className="md:col-span-2 rounded-[26px] border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">Permissions</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {permissionItems.map((item) => (
              <label key={item.key} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  name={item.key}
                  checked={form.permissions[item.key]}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-white/20 bg-transparent accent-amber-400"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        {state.message ? (
          <div
            className={`md:col-span-2 rounded-2xl border px-4 py-3 text-sm ${
              state.type === 'success'
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                : 'border-rose-400/30 bg-rose-400/10 text-rose-200'
            }`}
          >
            {state.message}
          </div>
        ) : null}

        <div className="md:col-span-2 flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate-400">
              Create the admin account, verify the email, and grant the permissions you want active immediately.
            </p>
            <Link to="/admin/signin" className="text-sm font-medium text-amber-300 transition hover:text-amber-200">
              Already have an admin account? Sign in
            </Link>
          </div>
          <motion.button
            type="submit"
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            disabled={state.loading}
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_36px_rgba(249,115,22,0.28)]"
          >
            {state.loading ? 'Creating...' : 'Create Admin Account'}
          </motion.button>
        </div>

        <div className="md:col-span-2">
          <GoogleAuthButton
            contextLabel="Admin Sign Up"
            buttonText="signup_with"
            onCredential={handleGoogleSignup}
            onError={(error) =>
              setState({
                loading: false,
                message: error.message || 'Unable to load Google sign up right now',
                type: 'error',
              })
            }
          />
        </div>
      </form>
    </motion.section>
  )
}

export default AdminSignup
