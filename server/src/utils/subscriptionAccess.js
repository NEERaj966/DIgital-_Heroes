import { getSubscriptionPlanConfig } from '../constants/subscriptionPlans.js'
import { Payment } from '../modules/Payment.module.js'

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

export const syncUserSubscriptionFromPayments = async (user) => {
  if (!user) {
    return user
  }

  const shouldRepairFromPayment =
    (user.subscription?.status === 'active' &&
      (!user.subscription?.planCode || !user.subscription?.billingCycle || !user.subscription?.subscribedAt)) ||
    (!user.subscription?.status && (!user.subscription?.planCode || !user.subscription?.billingCycle))

  if (!shouldRepairFromPayment) {
    return user
  }

  const paymentRecord = await Payment.findOne({
    paymentFor: 'subscription',
    paymentStatus: 'completed',
    $or: [{ user: user._id }, { customerEmail: normalizeEmail(user.email) }],
  }).sort({ createdAt: -1, _id: -1 })

  if (!paymentRecord) {
    return user
  }

  const subscriptionConfig = getSubscriptionPlanConfig(paymentRecord.subscriptionPlan)

  if (!subscriptionConfig) {
    return user
  }

  if (!user.subscription) {
    user.subscription = {}
  }

  let hasChanges = false

  if (!user.subscription.status) {
    user.subscription.status = 'active'
    hasChanges = true
  }

  if (!user.subscription.planCode) {
    user.subscription.planCode = subscriptionConfig.code
    hasChanges = true
  }

  if (!user.subscription.billingCycle) {
    user.subscription.billingCycle = subscriptionConfig.billingCycle
    hasChanges = true
  }

  if (!user.subscription.subscribedAt) {
    user.subscription.subscribedAt = paymentRecord.createdAt || new Date()
    hasChanges = true
  }

  if (hasChanges) {
    await user.save()
  }

  return user
}
