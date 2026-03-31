import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../utils/api'
import {
  DEFAULT_SUBSCRIPTION_PLAN,
  SUBSCRIPTION_PLANS,
  formatSubscriptionPlanName,
  isValidSubscriptionPlan,
} from '../constants/subscriptionPlans'
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

const UserSignup = () => {
  const navigate = useNavigate()
  const { clearAdminSession } = useAdmin()
  const { saveUserSession } = useUser()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPlan = searchParams.get('plan')
  const initialPlan = isValidSubscriptionPlan(requestedPlan) ? requestedPlan : DEFAULT_SUBSCRIPTION_PLAN
  const checkoutState = searchParams.get('checkout')
  const sessionId = searchParams.get('session_id')
  const hasConfirmedSession = useRef(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    handicap: '',
    avatar: null,
    subscriptionPlan: initialPlan,
  })
  const [state, setState] = useState({
    loading: false,
    message: '',
    type: '',
  })

  useEffect(() => {
    if (form.subscriptionPlan === initialPlan) {
      return
    }

    setForm((prev) => ({
      ...prev,
      subscriptionPlan: initialPlan,
    }))
  }, [form.subscriptionPlan, initialPlan])

  useEffect(() => {
    if (checkoutState !== 'cancelled') {
      return
    }

    setState({
      loading: false,
      message: 'Stripe checkout was cancelled before completing the subscription payment.',
      type: 'error',
    })
  }, [checkoutState])

  useEffect(() => {
    if (checkoutState !== 'success' || !sessionId || hasConfirmedSession.current) {
      return
    }

    hasConfirmedSession.current = true
    setState({
      loading: true,
      message: 'Verifying your Stripe payment and activating the subscription...',
      type: '',
    })

    const confirmCheckout = async () => {
      try {
        const response = await api.post('/users/subscription/confirm', { sessionId })
        const authUser = response.data?.data?.user
        const token = response.data?.data?.token

        if (authUser) {
          clearAdminSession()
          saveUserSession(authUser, token)
        }

        setState({
          loading: false,
          message: response.data?.message || 'Stripe payment verified successfully.',
          type: 'success',
        })

        navigate('/profile', { replace: true })
      } catch (error) {
        setState({
          loading: false,
          message: error.response?.data?.message || 'Unable to verify your Stripe payment right now.',
          type: 'error',
        })
      }
    }

    confirmCheckout()
  }, [checkoutState, clearAdminSession, navigate, saveUserSession, sessionId])

  const handleChange = (event) => {
    const { name, value, files } = event.target

    setForm((prev) => ({
      ...prev,
      [name]: name === 'avatar' ? files?.[0] || null : value,
    }))
  }

  const handlePlanSelect = (planCode) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('plan', planCode)
    nextParams.delete('checkout')
    nextParams.delete('session_id')
    setSearchParams(nextParams, { replace: true })

    setForm((prev) => ({
      ...prev,
      subscriptionPlan: planCode,
    }))
  }

  const redirectToCheckout = (checkoutUrl) => {
    if (!checkoutUrl) {
      throw new Error('Stripe checkout URL is not available')
    }

    window.location.assign(checkoutUrl)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setState({
      loading: true,
      message: '',
      type: '',
    })

    if (!form.subscriptionPlan) {
      setState({
        loading: false,
        message: 'Please choose a subscription plan before creating your account',
        type: 'error',
      })
      return
    }

    if ([form.name, form.email, form.password].some((field) => !field.trim())) {
      setState({
        loading: false,
        message: 'Name, email, and password are required before starting checkout',
        type: 'error',
      })
      return
    }

    try {
      const formData = new FormData()
      formData.append('name', form.name)
      formData.append('email', form.email)
      formData.append('password', form.password)
      formData.append('subscriptionPlan', form.subscriptionPlan)

      if (form.handicap !== '') {
        formData.append('handicap', form.handicap)
      }

      if (form.avatar) {
        formData.append('avatar', form.avatar)
      }

      const response = await api.post('/users/subscription/checkout-session', formData)
      redirectToCheckout(response.data?.data?.checkoutUrl)
    } catch (error) {
      setState({
        loading: false,
        message: error.response?.data?.message || 'Unable to start Stripe checkout right now',
        type: 'error',
      })
    }
  }

  const handleGoogleSignup = useCallback(
    async (googleToken) => {
      setState({
        loading: true,
        message: '',
        type: '',
      })

      try {
        if (!form.subscriptionPlan) {
          throw new Error('Please choose a subscription plan before continuing with Google')
        }

        const formData = new FormData()
        formData.append('googleToken', googleToken)
        formData.append('name', form.name)
        formData.append('subscriptionPlan', form.subscriptionPlan)

        if (form.handicap !== '') {
          formData.append('handicap', form.handicap)
        }

        if (form.avatar) {
          formData.append('avatar', form.avatar)
        }

        const response = await api.post('/users/subscription/google/checkout-session', formData)
        redirectToCheckout(response.data?.data?.checkoutUrl)
      } catch (error) {
        setState({
          loading: false,
          message: error.response?.data?.message || error.message || 'Unable to start Stripe checkout right now',
          type: 'error',
        })
      }
    },
    [form.avatar, form.handicap, form.name, form.subscriptionPlan]
  )

  return (
    <motion.section
      id="sign-up"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={cardVariants}
      className="auth-card relative overflow-hidden rounded-[34px] border border-white/10 p-5 sm:p-8 sm:py-10"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />

      <div className="mb-8 max-w-xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-amber-300 sm:text-sm sm:tracking-[0.35em]">
          User Sign Up
        </p>
        <h2 className="text-2xl font-semibold leading-tight text-white sm:text-4xl">
          Create your player account and start making every round count.
        </h2>
        <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
          Choose a subscription, continue through Stripe Checkout, and then return here to activate your subscriber account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2 rounded-[28px] border border-amber-300/20 bg-amber-300/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200 sm:tracking-[0.32em]">
            Subscription Required
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-200">
            Only users with an active subscription can sign in and access current user features. Your selected plan becomes active after successful Stripe payment verification.
          </p>
        </div>

        <div className="md:col-span-2">
          <label className="mb-3 block text-sm font-medium text-slate-200">Choose Your Plan</label>
          <div className="grid gap-4 lg:grid-cols-3">
            {SUBSCRIPTION_PLANS.map((plan) => {
              const isSelected = form.subscriptionPlan === plan.code

              return (
                <motion.button
                  key={plan.code}
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handlePlanSelect(plan.code)}
                  className={`rounded-[28px] border p-4 text-left transition sm:p-5 ${
                    isSelected
                      ? plan.code === 'popular-monthly'
                        ? 'border-amber-300/50 bg-amber-300/10 shadow-[0_20px_50px_rgba(249,115,22,0.16)]'
                        : plan.code === 'yearly'
                          ? 'border-emerald-400/35 bg-emerald-400/10 shadow-[0_20px_50px_rgba(16,185,129,0.14)]'
                          : 'border-white/20 bg-white/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-lg font-semibold text-white">{plan.name}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                        isSelected ? 'bg-white text-slate-950' : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {plan.badge}
                    </span>
                  </div>
                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-2xl font-semibold text-white sm:text-3xl">{plan.price}</span>
                    <span className="pb-1 text-sm text-slate-400">{plan.billingLabel}</span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{plan.description}</p>
                </motion.button>
              )
            })}
          </div>
        </div>

        <motion.div whileHover="hover" initial="rest" animate="rest" variants={fieldMotion} className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-slate-200">Full Name</label>
          <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="Enter your full name" className={inputClassName} required />
        </motion.div>

        <motion.div whileHover="hover" initial="rest" animate="rest" variants={fieldMotion}>
          <label className="mb-2 block text-sm font-medium text-slate-200">Email</label>
          <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Enter your email" className={inputClassName} required />
        </motion.div>

        <motion.div whileHover="hover" initial="rest" animate="rest" variants={fieldMotion}>
          <label className="mb-2 block text-sm font-medium text-slate-200">Password</label>
          <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Create a password" className={inputClassName} required />
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
            className="w-full rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-300 file:mb-2 file:mr-4 file:rounded-full file:border-0 file:bg-amber-300 file:px-4 file:py-2 file:font-semibold file:text-slate-950 sm:file:mb-0"
          />
        </motion.div>

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
              Selected plan: <span className="font-medium text-white">{formatSubscriptionPlanName(form.subscriptionPlan)}</span>
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <Link to="/subscription" className="font-medium text-amber-300 transition hover:text-amber-200">
                Compare plans again
              </Link>
              <Link to="/signin" className="font-medium text-amber-300 transition hover:text-amber-200">
                Already subscribed? Sign in
              </Link>
            </div>
          </div>
          <motion.button
            type="submit"
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            disabled={state.loading}
            className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_36px_rgba(249,115,22,0.28)] sm:w-auto"
          >
            {state.loading ? 'Preparing Checkout...' : 'Continue To Stripe'}
          </motion.button>
        </div>

        <div className="md:col-span-2">
          <GoogleAuthButton
            contextLabel="Sign Up"
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

export default UserSignup
