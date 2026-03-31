import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { adminApi } from '../utils/api'
import { useAdmin } from '../context/AdminContext'
import { useUser } from '../context/UserContext'
import GoogleAuthButton from '../componant/GoogleAuthButton'

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

const AdminSignIn = () => {
  const navigate = useNavigate()
  const { currentAdmin, saveAdminSession } = useAdmin()
  const { clearUserSession } = useUser()
  const [form, setForm] = useState({
    email: '',
    password: '',
  })
  const [state, setState] = useState({
    loading: false,
    message: '',
    type: '',
  })

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((prev) => ({
      ...prev,
      [name]: value,
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
      const response = await adminApi.post('/admins/login', {
        email: form.email,
        password: form.password,
      })

      const authAdmin = response.data?.data?.admin
      const token = response.data?.data?.token

      if (authAdmin) {
        clearUserSession()
        saveAdminSession(authAdmin, token)
      }

      setState({
        loading: false,
        message: response.data?.message || 'Admin signed in successfully',
        type: 'success',
      })

      setForm((prev) => ({
        ...prev,
        password: '',
      }))

      navigate('/admin/profile')
    } catch (error) {
      setState({
        loading: false,
        message: error.response?.data?.message || 'Unable to sign in right now',
        type: 'error',
      })
    }
  }

  const handleGoogleSignIn = useCallback(
    async (googleToken) => {
      setState({ loading: true, message: '', type: '' })

      try {
        const response = await adminApi.post('/admins/google/login', { googleToken })
        const authAdmin = response.data?.data?.admin
        const token = response.data?.data?.token

        if (authAdmin) {
          clearUserSession()
          saveAdminSession(authAdmin, token)
        }

        setState({
          loading: false,
          message: response.data?.message || 'Admin signed in with Google successfully',
          type: 'success',
        })

        navigate('/admin/profile')
      } catch (error) {
        setState({
          loading: false,
          message: error.response?.data?.message || 'Unable to sign in with Google right now',
          type: 'error',
        })
      }
    },
    [clearUserSession, navigate, saveAdminSession]
  )

  return (
    <motion.section
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={cardVariants}
      className="signin-card relative overflow-hidden rounded-[34px] border border-white/10 p-5 sm:p-8 sm:py-10"
    >
      <div className="relative z-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-amber-300 sm:text-sm sm:tracking-[0.35em]">
          Admin Sign In
        </p>
        <h2 className="text-2xl font-semibold text-white sm:text-3xl">Admin access panel.</h2>
        <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
          Sign in as an administrator to manage users, payments, donations, and platform activity.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative z-10 mt-8 grid gap-4">
        <motion.div whileHover="hover" initial="rest" animate="rest" variants={fieldMotion}>
          <label className="mb-2 block text-sm font-medium text-slate-200">Admin Email</label>
          <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Enter admin email" className={inputClassName} />
        </motion.div>

        <motion.div whileHover="hover" initial="rest" animate="rest" variants={fieldMotion}>
          <label className="mb-2 block text-sm font-medium text-slate-200">Password</label>
          <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Enter admin password" className={inputClassName} />
        </motion.div>

        <div className="flex flex-col items-start gap-3 py-1 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/admin/signup" className="text-amber-300 transition hover:text-amber-200">
            Create admin account
          </Link>
          <Link to="/signin" className="text-slate-300 transition hover:text-white">
            User sign in
          </Link>
        </div>

        {state.message ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              state.type === 'success'
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                : 'border-rose-400/30 bg-rose-400/10 text-rose-200'
            }`}
          >
            {state.message}
          </div>
        ) : null}

        <motion.button
          type="submit"
          whileHover={{ y: -3, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          disabled={state.loading}
          className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-amber-300/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(15,23,42,0.2)] backdrop-blur-md sm:w-auto"
        >
          {state.loading ? 'Signing In...' : 'Admin Sign In'}
        </motion.button>

        <GoogleAuthButton
          contextLabel="Admin Sign In"
          buttonText="signin_with"
          onCredential={handleGoogleSignIn}
          onError={(error) =>
            setState({
              loading: false,
              message: error.message || 'Unable to load Google sign in right now',
              type: 'error',
            })
          }
        />

        <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
            {currentAdmin ? 'Admin Signed In' : 'Admin Access'}
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {currentAdmin
              ? `You are connected as ${currentAdmin.userId?.name || currentAdmin.userId?.email}.`
              : 'Secure admin controls are available with either password sign in or Google sign in.'}
          </p>
        </div>
      </form>
    </motion.section>
  )
}

export default AdminSignIn
