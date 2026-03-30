export const SUBSCRIPTION_PLAN_CONFIG = {
  'regular-monthly': {
    code: 'regular-monthly',
    billingCycle: 'monthly',
    amount: 1200,
    currency: 'INR',
  },
  'popular-monthly': {
    code: 'popular-monthly',
    billingCycle: 'monthly',
    amount: 2900,
    currency: 'INR',
  },
  yearly: {
    code: 'yearly',
    billingCycle: 'yearly',
    amount: 29900,
    currency: 'INR',
  },
}

export const SUBSCRIPTION_PLAN_CODES = Object.keys(SUBSCRIPTION_PLAN_CONFIG)
export const SUBSCRIPTION_BILLING_CYCLES = ['monthly', 'yearly']
export const SUBSCRIPTION_STATUSES = ['active', 'inactive']

export const getSubscriptionPlanConfig = (planCode) => SUBSCRIPTION_PLAN_CONFIG[planCode]

export const hasActiveSubscription = (user) =>
  Boolean(
    user?.subscription &&
      (
        user.subscription.status === 'active' ||
        (
          user.subscription.status !== 'inactive' &&
          user.subscription.planCode &&
          user.subscription.billingCycle
        )
      )
  )
