export const SUBSCRIPTION_PLANS = [
  {
    code: 'regular-monthly',
    name: 'Starter Support',
    price: '$12',
    billingLabel: '/month',
    billingCycle: 'monthly',
    badge: 'Regular',
    description: 'A simple monthly membership for supporters who want access to the full player experience.',
    features: ['Full user login access', 'Profile and dashboard access', 'Community event updates'],
  },
  {
    code: 'popular-monthly',
    name: 'Player Plus',
    price: '$29',
    billingLabel: '/month',
    billingCycle: 'monthly',
    badge: 'Most Popular',
    description: 'The highlighted monthly plan for active players who want the complete subscribed experience.',
    features: ['Priority access feel', 'Full user feature access', 'Premium event and campaign updates'],
  },
  {
    code: 'yearly',
    name: 'Annual Impact',
    price: '$299',
    billingLabel: '/year',
    billingCycle: 'yearly',
    badge: 'Yearly',
    description: 'A discounted annual membership for long-term supporters who want uninterrupted access.',
    features: ['One yearly subscription', 'Full user feature access', 'Best value for recurring supporters'],
  },
]

export const DEFAULT_SUBSCRIPTION_PLAN = 'popular-monthly'

export const getSubscriptionPlan = (planCode) =>
  SUBSCRIPTION_PLANS.find((plan) => plan.code === planCode) || SUBSCRIPTION_PLANS[1]

export const isValidSubscriptionPlan = (planCode) =>
  SUBSCRIPTION_PLANS.some((plan) => plan.code === planCode)

export const formatSubscriptionPlanName = (planCode) => getSubscriptionPlan(planCode).name
export const formatSafeSubscriptionPlanName = (planCode) =>
  isValidSubscriptionPlan(planCode) ? getSubscriptionPlan(planCode).name : 'No active plan'

export const formatSubscriptionStatus = (status) => {
  if (!status) {
    return 'Inactive'
  }

  return status.charAt(0).toUpperCase() + status.slice(1)
}
