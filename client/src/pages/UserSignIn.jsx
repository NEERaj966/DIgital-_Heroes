import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { useAdmin } from '../context/AdminContext'
import { useUser } from '../context/UserContext'
import { formatSafeSubscriptionPlanName, formatSubscriptionStatus } from '../constants/subscriptionPlans'
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

const UserSignIn = () => {
  const navigate = useNavigate()
  const { clearAdminSession } = useAdmin()
  const { currentUser, saveUserSession, sessionNotice } = useUser()
  const [form, setForm] = useState({
    email: '',
    password: '',
    remember: false,
  })
  const [state, setState] = useState({
    loading: false,
    message: '',
    type: '',
  })

  const handleChange = (event) => {
    const { name, value, checked, type } = event.target

    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
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
      const response = await api.post('/users/login', {
        email: form.email,
        password: form.password,
      })

      const authUser = response.data?.data?.user
      const token = response.data?.data?.token

      if (authUser) {
        clearAdminSession()
        saveUserSession(authUser, token)
      }

      setState({
        loading: false,
        message: response.data?.message || 'Signed in successfully',
        type: 'success',
      })

      setForm((prev) => ({
        ...prev,
        password: '',
      }))

      navigate('/profile')
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
        const response = await api.post('/users/google/login', { googleToken })
        const authUser = response.data?.data?.user
        const token = response.data?.data?.token

        if (authUser) {
          clearAdminSession()
          saveUserSession(authUser, token)
        }

        setState({
          loading: false,
          message: response.data?.message || 'Signed in with Google successfully',
          type: 'success',
        })

        navigate('/profile')
      } catch (error) {
        setState({
          loading: false,
          message: error.response?.data?.message || 'Unable to sign in with Google right now',
          type: 'error',
        })
      }
    },
    [clearAdminSession, navigate, saveUserSession]
  )

  return (
    <motion.section
      id="sign-in"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={cardVariants}
      className="signin-card relative overflow-hidden rounded-[34px] border border-white/10 p-8 sm:p-10"
    >
      <div className="absolute -right-12 top-8 h-28 w-28 rounded-full bg-amber-300/12 blur-3xl" />
      <div className="absolute -left-12 bottom-8 h-28 w-28 rounded-full bg-orange-400/10 blur-3xl" />

      <div className="relative z-10">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">
          User Sign In
        </p>
        <h2 className="text-3xl font-semibold text-white">Welcome back.</h2>
        <p className="mt-4 text-base leading-8 text-slate-300">
          Only users with an active subscription can sign in and continue using current user features.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative z-10 mt-8 grid gap-4">
        {sessionNotice ? (
          <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            {sessionNotice}
          </div>
        ) : null}

        <motion.div whileHover="hover" initial="rest" animate="rest" variants={fieldMotion}>
          <label className="mb-2 block text-sm font-medium text-slate-200">Email</label>
          <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Enter your email" className={inputClassName} />
        </motion.div>

        <motion.div whileHover="hover" initial="rest" animate="rest" variants={fieldMotion}>
          <label className="mb-2 block text-sm font-medium text-slate-200">Password</label>
          <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Enter your password" className={inputClassName} />
        </motion.div>

        <div className="flex items-center justify-between gap-4 py-1 text-sm text-slate-400">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="remember" checked={form.remember} onChange={handleChange} className="h-4 w-4 rounded border-white/20 bg-transparent accent-amber-400" />
            <span>Remember me</span>
          </label>
          <Link to="/subscription" className="text-amber-300 transition hover:text-amber-200">
            Choose a plan
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
          className="mt-2 inline-flex items-center justify-center rounded-full border border-amber-300/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(15,23,42,0.2)] backdrop-blur-md"
        >
          {state.loading ? 'Signing In...' : 'Sign In'}
        </motion.button>

        <GoogleAuthButton
          contextLabel="Sign In"
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
            {currentUser ? 'Signed In' : 'Account Access'}
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {currentUser
              ? `You are connected as ${currentUser.name || currentUser.email} with ${formatSafeSubscriptionPlanName(currentUser.subscription?.planCode)} on ${formatSubscriptionStatus(currentUser.subscription?.status).toLowerCase()} status.`
              : 'Secure sign in is reserved for subscribed users. Choose a plan first, then create your account with email/password or Google and return here.'}
          </p>
        </div>
      </form>
    </motion.section>
  )
}

export default UserSignIn
