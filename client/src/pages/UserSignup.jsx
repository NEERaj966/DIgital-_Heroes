import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../utils/api'
import { loadRazorpayCheckout } from '../utils/razorpay'
import {
  DEFAULT_SUBSCRIPTION_PLAN,
  SUBSCRIPTION_PLANS,
  formatSubscriptionPlanName,
  isValidSubscriptionPlan,
} from '../constants/subscriptionPlans'
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

const openRazorpayCheckout = ({ keyId, order, customer }) =>
  new Promise((resolve, reject) => {
    const Razorpay = window.Razorpay

    if (!Razorpay) {
      reject(new Error('Razorpay checkout is not available'))
      return
    }

    const razorpay = new Razorpay({
      key: keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'Digital Heroes',
      description: 'Subscription payment',
      order_id: order.id,
      prefill: {
        name: customer.name,
        email: customer.email,
      },
      theme: {
        color: '#f59e0b',
      },
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    })

    razorpay.open()
  })

const UserSignup = () => {
  const navigate = useNavigate()
  const { clearAdminSession } = useAdmin()
  const { saveUserSession } = useUser()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPlan = searchParams.get('plan')
  const initialPlan = isValidSubscriptionPlan(requestedPlan) ? requestedPlan : DEFAULT_SUBSCRIPTION_PLAN
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
    setSearchParams(nextParams, { replace: true })

    setForm((prev) => ({
      ...prev,
      subscriptionPlan: planCode,
    }))
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
        message: 'Name, email, and password are required before starting payment',
        type: 'error',
      })
      return
    }

    try {
      const orderResponse = await api.post('/users/subscription/order', {
        name: form.name,
        email: form.email,
        subscriptionPlan: form.subscriptionPlan,
      })

      const Razorpay = await loadRazorpayCheckout()

      if (!Razorpay) {
        throw new Error('Unable to initialize Razorpay checkout')
      }

      const paymentData = await openRazorpayCheckout({
        keyId: orderResponse.data?.data?.keyId,
        order: orderResponse.data?.data?.order,
        customer: {
          name: form.name,
          email: form.email,
        },
      })

      const formData = new FormData()
      formData.append('name', form.name)
      formData.append('email', form.email)
      formData.append('password', form.password)
      formData.append('subscriptionPlan', form.subscriptionPlan)
      formData.append('razorpayOrderId', paymentData.razorpay_order_id)
      formData.append('razorpayPaymentId', paymentData.razorpay_payment_id)
      formData.append('razorpaySignature', paymentData.razorpay_signature)

      if (form.handicap !== '') {
        formData.append('handicap', form.handicap)
      }

      if (form.avatar) {
        formData.append('avatar', form.avatar)
      }

      const response = await api.post('/users/register', formData)
      const authUser = response.data?.data?.user
      const token = response.data?.data?.token

      setState({
        loading: false,
        message: response.data?.message || 'Account created successfully',
        type: 'success',
      })

      setForm({
        name: '',
        email: '',
        password: '',
        handicap: '',
        avatar: null,
        subscriptionPlan: DEFAULT_SUBSCRIPTION_PLAN,
      })

      if (authUser) {
        clearAdminSession()
        saveUserSession(authUser, token)
      }

      navigate('/profile')
    } catch (error) {
      const fallbackMessage =
        error.message === 'Payment cancelled'
          ? 'Razorpay checkout was cancelled before completing the subscription payment'
          : 'Unable to create account right now'

      setState({
        loading: false,
        message: error.response?.data?.message || fallbackMessage,
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
        const googleProfile = decodeGoogleCredential(googleToken)
        const customerName = form.name.trim() || googleProfile.name || googleProfile.given_name || 'Google User'
        const customerEmail = googleProfile.email

        if (!form.subscriptionPlan) {
          throw new Error('Please choose a subscription plan before continuing with Google')
        }

        const orderResponse = await api.post('/users/subscription/order', {
          name: customerName,
          email: customerEmail,
          subscriptionPlan: form.subscriptionPlan,
        })

        const Razorpay = await loadRazorpayCheckout()

        if (!Razorpay) {
          throw new Error('Unable to initialize Razorpay checkout')
        }

        const paymentData = await openRazorpayCheckout({
          keyId: orderResponse.data?.data?.keyId,
          order: orderResponse.data?.data?.order,
          customer: {
            name: customerName,
            email: customerEmail,
          },
        })

        const formData = new FormData()
        formData.append('googleToken', googleToken)
        formData.append('name', customerName)
        formData.append('subscriptionPlan', form.subscriptionPlan)
        formData.append('razorpayOrderId', paymentData.razorpay_order_id)
        formData.append('razorpayPaymentId', paymentData.razorpay_payment_id)
        formData.append('razorpaySignature', paymentData.razorpay_signature)

        if (form.handicap !== '') {
          formData.append('handicap', form.handicap)
        }

        if (form.avatar) {
          formData.append('avatar', form.avatar)
        }

        const response = await api.post('/users/google/register', formData)
        const authUser = response.data?.data?.user
        const token = response.data?.data?.token

        if (authUser) {
          clearAdminSession()
          saveUserSession(authUser, token)
        }

        setState({
          loading: false,
          message: response.data?.message || 'Account created with Google successfully',
          type: 'success',
        })

        navigate('/profile')
      } catch (error) {
        const fallbackMessage =
          error.message === 'Payment cancelled'
            ? 'Razorpay checkout was cancelled before completing the subscription payment'
            : 'Unable to create your Google account right now'

        setState({
          loading: false,
          message: error.response?.data?.message || error.message || fallbackMessage,
          type: 'error',
        })
      }
    },
    [clearAdminSession, form.avatar, form.handicap, form.name, form.subscriptionPlan, navigate, saveUserSession]
  )

  return (
    <motion.section
      id="sign-up"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={cardVariants}
      className="auth-card relative overflow-hidden rounded-[34px] border border-white/10 p-8 sm:p-10"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />

      <div className="mb-8 max-w-xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">
          User Sign Up
        </p>
        <h2 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
          Create your player account and start making every round count.
        </h2>
        <p className="mt-4 text-base leading-8 text-slate-300">
          Choose a subscription, complete the Razorpay payment, and create your subscriber account with email/password or Google.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2 rounded-[28px] border border-amber-300/20 bg-amber-300/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-200">
            Subscription Required
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-200">
            Only users with an active subscription can sign in and access current user features. Your selected plan becomes active after successful Razorpay payment.
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
                  className={`rounded-[28px] border p-5 text-left transition ${
                    isSelected
                      ? plan.code === 'popular-monthly'
                        ? 'border-amber-300/50 bg-amber-300/10 shadow-[0_20px_50px_rgba(249,115,22,0.16)]'
                        : plan.code === 'yearly'
                          ? 'border-emerald-400/35 bg-emerald-400/10 shadow-[0_20px_50px_rgba(16,185,129,0.14)]'
                          : 'border-white/20 bg-white/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
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
                    <span className="text-3xl font-semibold text-white">{plan.price}</span>
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
            className="w-full rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-amber-300 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
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
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_36px_rgba(249,115,22,0.28)]"
          >
            {state.loading ? 'Processing Payment...' : 'Pay & Create Account'}
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
