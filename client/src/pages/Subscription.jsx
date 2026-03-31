import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  DEFAULT_SUBSCRIPTION_PLAN,
  SUBSCRIPTION_PLANS,
} from '../constants/subscriptionPlans'

const sectionVariants = {
  hidden: { opacity: 0, y: 32 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

const benefits = [
  'Only subscribed users can sign in and access current user features.',
  'Choose between one regular monthly, one popular monthly, or one yearly plan.',
  'Move from plan selection to signup with the selected plan already attached.',
]

const Subscription = () => {
  const [selectedPlan, setSelectedPlan] = useState(DEFAULT_SUBSCRIPTION_PLAN)

  const getPlanStateClasses = (planCode, isSelected) => {
    if (!isSelected) {
      return 'border-white/8 hover:border-white/15 hover:bg-white/5'
    }

    if (planCode === 'popular-monthly') {
      return 'border-amber-300/40 shadow-[0_24px_80px_rgba(249,115,22,0.18)] -translate-y-1'
    }

    if (planCode === 'yearly') {
      return 'border-emerald-400/30 shadow-[0_24px_80px_rgba(16,185,129,0.16)] -translate-y-1'
    }

    return 'border-white/20 -translate-y-1'
  }

  return (
    <motion.section
      initial="hidden"
      animate="show"
      variants={sectionVariants}
      className="space-y-8"
    >
      <section className="hero-panel overflow-hidden rounded-[28px] border border-white/10 px-5 py-10 shadow-[0_30px_100px_rgba(15,23,42,0.45)] sm:rounded-[36px] sm:px-10 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-amber-300 sm:text-sm sm:tracking-[0.35em]">
              Subscription Plans
            </p>
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-5xl">
              Choose your subscription before creating a user account.
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-300 sm:text-lg sm:leading-8">
              Only subscribed users can sign in and use current user features, so pick the plan that fits you first.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to={`/signup?plan=${selectedPlan}`}
                className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_36px_rgba(249,115,22,0.28)] sm:w-auto"
              >
                Start Membership
              </Link>
              <Link
                to="/signin"
                className="inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/10 sm:w-auto"
              >
                Sign In
              </Link>
            </div>
          </div>

          <div className="content-panel rounded-[32px] border border-white/10 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400 sm:tracking-[0.32em]">
              Included With Every Plan
            </p>
            <div className="mt-5 space-y-3">
              {benefits.map((benefit) => (
                <div
                  key={benefit}
                  className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-4"
                >
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-amber-300" />
                  <p className="text-sm leading-7 text-slate-200">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <motion.section
        variants={sectionVariants}
        className="content-panel rounded-[32px] border border-white/10 p-6 sm:p-8"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300 sm:text-sm sm:tracking-[0.28em]">
              Plans
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Flexible pricing for every kind of supporter</h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-slate-300">
            Pick one regular monthly plan, one popular monthly plan, or one yearly plan before continuing.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.code

            return (
              <motion.button
                key={plan.code}
                type="button"
                variants={itemVariants}
                onClick={() => setSelectedPlan(plan.code)}
                className={`text-left rounded-[30px] border bg-slate-950/50 p-5 sm:p-6 transition ${getPlanStateClasses(plan.code, isSelected)}`}
              >
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xl font-semibold text-white">{plan.name}</p>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                      isSelected
                        ? 'bg-amber-300 text-slate-950'
                        : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {plan.badge}
                  </span>
                </div>

                <div className="mt-5 flex items-end gap-1">
                  <span className="text-3xl font-semibold text-white sm:text-4xl">{plan.price}</span>
                  <span className="pb-1 text-sm text-slate-400">{plan.billingLabel}</span>
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-300">{plan.description}</p>

                <div className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-emerald-300" />
                      <span className="text-sm text-slate-200">{feature}</span>
                    </div>
                  ))}
                </div>
              </motion.button>
            )
          })}
        </div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"
      >
        <div className="content-panel rounded-[32px] border border-white/10 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300 sm:text-sm sm:tracking-[0.28em]">
            Selected Plan
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
            {SUBSCRIPTION_PLANS.find((plan) => plan.code === selectedPlan)?.name}
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            This selected plan is passed into signup immediately so active subscribers can sign in and use the current user features.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              to={`/signup?plan=${selectedPlan}`}
              className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_36px_rgba(249,115,22,0.28)] sm:w-auto"
            >
              Continue to Sign Up
            </Link>
            <Link
              to="/"
              className="inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
            >
              Back to Home
            </Link>
          </div>
        </div>

        <div className="content-panel rounded-[32px] border border-white/10 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300 sm:text-sm sm:tracking-[0.28em]">
            Why Subscribe
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] border border-white/8 bg-white/5 p-5">
              <h3 className="text-lg font-semibold text-white">More Event Access</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Subscribed users can sign in and keep access to the current user experience across the platform.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/8 bg-white/5 p-5">
              <h3 className="text-lg font-semibold text-white">Stronger Impact Tracking</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                The popular monthly option stays highlighted, while the yearly option gives a longer-term membership path.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/8 bg-white/5 p-5">
              <h3 className="text-lg font-semibold text-white">Cleaner Donor Journey</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Users choose a subscription first and carry that selection directly into signup with the plan in the URL.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/8 bg-white/5 p-5">
              <h3 className="text-lg font-semibold text-white">Ready for Billing Later</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Payment can still be added later, but the subscription-gated access model is enforced now.
              </p>
            </div>
          </div>
        </div>
      </motion.section>
    </motion.section>
  )
}

export default Subscription
