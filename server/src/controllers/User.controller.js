import { User } from '../modules/user.module.js'
import { asyncHandler } from '../utils/AsyncHanddler.js'
import { ApiError } from '../utils/Apierror.js'
import { ApiResponse } from '../utils/Apiresponse.js'
import { blackListTokenModel } from '../modules/blacklist.module.js'
import { uploadOnCloudinary } from '../utils/Cloudinary.js'
import { getSubscriptionPlanConfig, hasActiveSubscription } from '../constants/subscriptionPlans.js'
import { Payment } from '../modules/Payment.module.js'
import { Draw } from '../modules/Draw.module.js'
import { Score } from '../modules/Score.module.js'
import { Charity } from '../modules/Charities.module.js'
import { verifyGoogleToken } from '../utils/googleAuth.js'
import { applyNormalizedWinnerState, normalizePayoutStatus } from '../utils/winnerState.js'
import { syncUserSubscriptionFromPayments } from '../utils/subscriptionAccess.js'
import { createStripeSubscriptionCheckoutSession, retrieveStripeCheckoutSession } from '../utils/stripe.js'
import {
    createWinnerPayoutSetupLink,
    normalizePayoutEmail,
    syncLatestUserPayout
} from '../utils/winnerPayout.js'

const getCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax"
})

const getUserPublicProfile = async (userId) => {
    const user = await User.findById(userId)
        .populate({
            path: "preferredCharity",
            select: "name description logo website totalDonations"
        })
        .select("-password")

    await syncLatestUserPayout(user)

    return applyNormalizedWinnerState(user)
}

const respondWithUserSession = async (res, user, message, statusCode = 200) => {
    await syncUserSubscriptionFromPayments(user)
    const loggedInUser = await getUserPublicProfile(user._id)
    const token = user.generateAuthToken()
    const options = getCookieOptions()

    return res
        .status(statusCode)
        .cookie("authtoken", token, options)
        .json(
            new ApiResponse(
                statusCode,
                {
                    user: loggedInUser,
                    token
                },
                message
            )
        )
}

const validateStablefordScore = (scoreValue) => {
    const parsedScore = Number(scoreValue)

    if (!Number.isInteger(parsedScore) || parsedScore < 1 || parsedScore > 45) {
        throw new ApiError(400, "Score must be an integer between 1 and 45")
    }

    return parsedScore
}

const validatePlayedAtDate = (playedAt) => {
    const parsedDate = new Date(playedAt)

    if (!playedAt || Number.isNaN(parsedDate.getTime())) {
        throw new ApiError(400, "A valid score date is required")
    }

    return parsedDate
}

const trimUserScoresToLatestFive = async (userId) => {
    const scores = await Score.find({ player: userId })
        .sort({ playedAt: -1, createdAt: -1 })

    if (scores.length <= 5) {
        return
    }

    const scoresToRemove = scores.slice(5).map((score) => score._id)
    await Score.deleteMany({ _id: { $in: scoresToRemove } })
}

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()
const normalizeBeneficiaryName = (value) => String(value || '').trim()
const trimTrailingSlashes = (value) => String(value || '').replace(/\/+$/, '')

const getClientAppUrl = (req) => {
    const configuredUrl = trimTrailingSlashes(process.env.CLIENT_APP_URL || process.env.FRONTEND_URL)

    if (/^https?:\/\//i.test(configuredUrl)) {
        return configuredUrl
    }

    const requestOrigin = trimTrailingSlashes(req.get('origin'))

    if (/^https?:\/\//i.test(requestOrigin)) {
        return requestOrigin
    }

    const referer = String(req.get('referer') || '').trim()

    if (referer) {
        try {
            return trimTrailingSlashes(new URL(referer).origin)
        } catch {
            // Ignore invalid referer values and fall back to localhost.
        }
    }

    return 'http://localhost:5173'
}

const hasCompletedSubscriptionPayment = async (userId, email) =>
    Payment.findOne({
        paymentFor: 'subscription',
        paymentStatus: 'completed',
        $or: [{ user: userId }, { customerEmail: normalizeEmail(email) }]
    }).sort({ createdAt: -1, _id: -1 })

const ensureReusableCheckoutUser = async (user, email) => {
    if (!user) {
        return null
    }

    if (user.role === 'admin') {
        throw new ApiError(403, 'This email is already linked to an admin account. Please use a different email.')
    }

    await syncUserSubscriptionFromPayments(user)

    if (hasActiveSubscription(user) || await hasCompletedSubscriptionPayment(user._id, email)) {
        throw new ApiError(409, 'An active account with this email already exists. Please sign in instead.')
    }

    return user
}

const buildCheckoutUrls = (req, subscriptionPlan) => {
    const clientAppUrl = getClientAppUrl(req)

    return {
        successUrl: `${clientAppUrl}/signup?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${clientAppUrl}/signup?checkout=cancelled&plan=${encodeURIComponent(subscriptionPlan)}`
    }
}

const validatePayoutDetails = ({ beneficiaryName, email, fallbackEmail, fallbackBeneficiaryName }) => {
    const normalizedBeneficiaryName = normalizeBeneficiaryName(beneficiaryName || fallbackBeneficiaryName)
    const normalizedEmail = normalizePayoutEmail(email || fallbackEmail)

    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new ApiError(400, "A valid payout email is required for Stripe winner payouts")
    }

    return {
        beneficiaryName: normalizedBeneficiaryName,
        email: normalizedEmail
    }
}

const ensureUserGoogleAccess = (userLikeRecord) => {
    if (!userLikeRecord) {
        return
    }

    if (userLikeRecord.role === "admin") {
        throw new ApiError(403, "This Google account is linked to an admin profile. Please continue through admin sign in.")
    }
}

const uploadAvatarIfPresent = async (req, folder, fallbackAvatar = "") => {
    if (!req.file) {
        return fallbackAvatar
    }

    const uploadedAvatar = await uploadOnCloudinary(req.file.path, folder)

    if (!uploadedAvatar?.secure_url) {
        throw new ApiError(500, "Something went wrong while uploading avatar")
    }

    return uploadedAvatar.secure_url
}

const createStripePaymentRecord = async ({ user, subscriptionConfig, session, customerName, customerEmail }) =>
    Payment.create({
        user: user._id,
        paymentFor: 'subscription',
        provider: 'stripe',
        subscriptionPlan: subscriptionConfig.code,
        amount: subscriptionConfig.amount,
        currency: subscriptionConfig.currency,
        paymentMethod: 'stripe',
        paymentStatus: 'pending',
        providerSessionId: session.id,
        providerSubscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
        providerCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
        receipt: `stripe_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
        customerName,
        customerEmail
    })

const upsertPasswordCheckoutUser = async ({ req, subscriptionConfig }) => {
    const { name, email, password, handicap } = req.body

    if ([name, email, password].some((field) => !field || String(field).trim() === '')) {
        throw new ApiError(400, 'Name, email, and password are required before starting Stripe checkout')
    }

    const normalizedEmail = normalizeEmail(email)
    const existingUser = await ensureReusableCheckoutUser(await User.findOne({ email: normalizedEmail }), normalizedEmail)
    const avatarUrl = await uploadAvatarIfPresent(req, 'users/avatar', existingUser?.avatar || '')

    if (existingUser) {
        existingUser.name = name.trim()
        existingUser.email = normalizedEmail
        existingUser.password = password.trim()
        existingUser.authProvider = 'password'
        existingUser.avatar = avatarUrl
        existingUser.handicap = handicap
        existingUser.subscription = {
            planCode: subscriptionConfig.code,
            billingCycle: subscriptionConfig.billingCycle,
            status: 'inactive',
            subscribedAt: undefined
        }
        await existingUser.save()
        return existingUser
    }

    return User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: password.trim(),
        role: 'player',
        authProvider: 'password',
        avatar: avatarUrl,
        handicap,
        subscription: {
            planCode: subscriptionConfig.code,
            billingCycle: subscriptionConfig.billingCycle,
            status: 'inactive'
        }
    })
}

const upsertGoogleCheckoutUser = async ({ req, subscriptionConfig }) => {
    const { googleToken, name, handicap } = req.body

    if (!googleToken || !String(googleToken).trim()) {
        throw new ApiError(400, 'Google credential is required')
    }

    const googleProfile = await verifyGoogleToken(googleToken)
    const conflictingAdmin = await User.findOne({
        role: 'admin',
        $or: [{ googleId: googleProfile.googleId }, { email: googleProfile.email }]
    })

    ensureUserGoogleAccess(conflictingAdmin)

    const existingUser = await ensureReusableCheckoutUser(
        await User.findOne({
            role: { $ne: 'admin' },
            $or: [{ googleId: googleProfile.googleId }, { email: googleProfile.email }]
        }),
        googleProfile.email
    )
    const avatarUrl = await uploadAvatarIfPresent(req, 'users/avatar', existingUser?.avatar || googleProfile.avatar)

    if (existingUser) {
        existingUser.name = String(name || '').trim() || googleProfile.name
        existingUser.email = googleProfile.email
        existingUser.authProvider = 'google'
        existingUser.googleId = googleProfile.googleId
        existingUser.avatar = avatarUrl
        existingUser.handicap = handicap
        existingUser.subscription = {
            planCode: subscriptionConfig.code,
            billingCycle: subscriptionConfig.billingCycle,
            status: 'inactive',
            subscribedAt: undefined
        }
        await existingUser.save()
        return existingUser
    }

    return User.create({
        name: String(name || '').trim() || googleProfile.name,
        email: googleProfile.email,
        role: 'player',
        authProvider: 'google',
        googleId: googleProfile.googleId,
        avatar: avatarUrl,
        handicap,
        subscription: {
            planCode: subscriptionConfig.code,
            billingCycle: subscriptionConfig.billingCycle,
            status: 'inactive'
        }
    })
}

const finalizeStripeSubscriptionForUser = async (sessionId) => {
    const normalizedSessionId = String(sessionId || '').trim()

    if (!normalizedSessionId) {
        throw new ApiError(400, 'Stripe session ID is required')
    }

    const paymentRecord = await Payment.findOne({
        provider: 'stripe',
        providerSessionId: normalizedSessionId,
        paymentFor: 'subscription'
    })

    if (!paymentRecord) {
        throw new ApiError(404, 'Stripe payment session was not found')
    }

    const stripeSession = await retrieveStripeCheckoutSession(normalizedSessionId)

    if (stripeSession.status === 'expired') {
        paymentRecord.paymentStatus = 'failed'
        await paymentRecord.save()
        throw new ApiError(400, 'Stripe checkout session expired before payment was completed')
    }

    if (stripeSession.payment_status !== 'paid') {
        throw new ApiError(400, 'Stripe payment has not been completed yet')
    }

    const user = await User.findById(paymentRecord.user)

    if (!user) {
        throw new ApiError(404, 'User not found for this payment session')
    }

    const sessionUserId = stripeSession.metadata?.userId

    if (sessionUserId && String(user._id) !== String(sessionUserId)) {
        throw new ApiError(400, 'Stripe session does not match the expected user')
    }

    const subscriptionConfig = getSubscriptionPlanConfig(paymentRecord.subscriptionPlan)

    if (!subscriptionConfig) {
        throw new ApiError(400, 'A valid subscription plan is required')
    }

    paymentRecord.paymentStatus = 'completed'
    paymentRecord.amount = Number.isFinite(Number(stripeSession.amount_total))
        ? Number(stripeSession.amount_total)
        : paymentRecord.amount
    paymentRecord.currency = String(stripeSession.currency || paymentRecord.currency || 'INR').toUpperCase()
    paymentRecord.transactionId =
        (typeof stripeSession.subscription === 'string' ? stripeSession.subscription : stripeSession.subscription?.id) ||
        stripeSession.payment_intent ||
        normalizedSessionId
    paymentRecord.providerPaymentIntentId =
        typeof stripeSession.payment_intent === 'string'
            ? stripeSession.payment_intent
            : paymentRecord.providerPaymentIntentId
    paymentRecord.providerSubscriptionId =
        (typeof stripeSession.subscription === 'string' ? stripeSession.subscription : stripeSession.subscription?.id) ||
        paymentRecord.providerSubscriptionId
    paymentRecord.providerCustomerId =
        (typeof stripeSession.customer === 'string' ? stripeSession.customer : paymentRecord.providerCustomerId) ||
        paymentRecord.providerCustomerId
    await paymentRecord.save()

    user.subscription = {
        planCode: subscriptionConfig.code,
        billingCycle: subscriptionConfig.billingCycle,
        status: 'active',
        subscribedAt: stripeSession.created ? new Date(Number(stripeSession.created) * 1000) : new Date()
    }
    await user.save()

    return user
}

const linkGoogleIdentityToUser = async (user, googleProfile) => {
    let hasChanges = false

    if (!user.googleId || user.googleId !== googleProfile.googleId) {
        user.googleId = googleProfile.googleId
        hasChanges = true
    }

    if (user.email !== googleProfile.email) {
        user.email = googleProfile.email
        hasChanges = true
    }

    if (!user.avatar && googleProfile.avatar) {
        user.avatar = googleProfile.avatar
        hasChanges = true
    }

    if (user.authProvider !== "google" && !user.password) {
        user.authProvider = "google"
        hasChanges = true
    }

    if (hasChanges) {
        await user.save()
    }

    return user
}

const createSubscriptionCheckoutSession = asyncHandler(async (req, res) => {
    const normalizedPlan = String(req.body?.subscriptionPlan || '').trim()

    if (!normalizedPlan) {
        throw new ApiError(400, 'Subscription plan is required')
    }

    const subscriptionConfig = getSubscriptionPlanConfig(normalizedPlan)

    if (!subscriptionConfig) {
        throw new ApiError(400, 'A valid subscription plan is required')
    }

    const user = await upsertPasswordCheckoutUser({ req, subscriptionConfig })
    const { successUrl, cancelUrl } = buildCheckoutUrls(req, subscriptionConfig.code)
    const stripeSession = await createStripeSubscriptionCheckoutSession({
        customerEmail: user.email,
        customerName: user.name,
        subscriptionPlan: subscriptionConfig.code,
        userId: user._id,
        successUrl,
        cancelUrl
    })

    await createStripePaymentRecord({
        user,
        subscriptionConfig,
        session: stripeSession,
        customerName: user.name,
        customerEmail: user.email
    })

    return res.status(201).json(
        new ApiResponse(
            201,
            {
                checkoutUrl: stripeSession.url,
                sessionId: stripeSession.id
            },
            'Stripe checkout session created successfully'
        )
    )
})

const createGoogleSubscriptionCheckoutSession = asyncHandler(async (req, res) => {
    const normalizedPlan = String(req.body?.subscriptionPlan || '').trim()

    if (!normalizedPlan) {
        throw new ApiError(400, 'Subscription plan is required')
    }

    const subscriptionConfig = getSubscriptionPlanConfig(normalizedPlan)

    if (!subscriptionConfig) {
        throw new ApiError(400, 'A valid subscription plan is required')
    }

    const user = await upsertGoogleCheckoutUser({ req, subscriptionConfig })
    const { successUrl, cancelUrl } = buildCheckoutUrls(req, subscriptionConfig.code)
    const stripeSession = await createStripeSubscriptionCheckoutSession({
        customerEmail: user.email,
        customerName: user.name,
        subscriptionPlan: subscriptionConfig.code,
        userId: user._id,
        successUrl,
        cancelUrl
    })

    await createStripePaymentRecord({
        user,
        subscriptionConfig,
        session: stripeSession,
        customerName: user.name,
        customerEmail: user.email
    })

    return res.status(201).json(
        new ApiResponse(
            201,
            {
                checkoutUrl: stripeSession.url,
                sessionId: stripeSession.id
            },
            'Stripe checkout session created successfully'
        )
    )
})

const confirmSubscriptionCheckout = asyncHandler(async (req, res) => {
    const { sessionId } = req.body
    const user = await finalizeStripeSubscriptionForUser(sessionId)
    return respondWithUserSession(res, user, 'Stripe payment verified successfully', 200)
})

const loginUser = asyncHandler(async (req, res) =>{
    const { email, password } = req.body

    if (!email || !password) {
        throw new ApiError(400, "Email and password are required")
    }

    const normalizedEmail = normalizeEmail(email)
    const user = await User.findOne({ email: normalizedEmail })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    if (!user.password) {
        throw new ApiError(400, "This account uses Google sign in. Please continue with Google.")
    }

    const isPasswordValid = await user.ispasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
    }

    await syncUserSubscriptionFromPayments(user)

    if (!hasActiveSubscription(user)) {
        throw new ApiError(403, "Active subscription required to sign in and use user features.")
    }

    return respondWithUserSession(res, user, "User logged In Successfully")
})

const googleLoginUser = asyncHandler(async (req, res) => {
    const { googleToken } = req.body
    const googleProfile = await verifyGoogleToken(googleToken)
    const conflictingAdmin = await User.findOne({
        role: "admin",
        $or: [
            { googleId: googleProfile.googleId },
            { email: googleProfile.email }
        ]
    })
    ensureUserGoogleAccess(conflictingAdmin)

    const user = await User.findOne({
        role: { $ne: "admin" },
        $or: [
            { googleId: googleProfile.googleId },
            { email: googleProfile.email }
        ]
    })

    if (!user) {
        throw new ApiError(404, "User account not found. Please sign up first.")
    }

    ensureUserGoogleAccess(user)
    await linkGoogleIdentityToUser(user, googleProfile)
    await syncUserSubscriptionFromPayments(user)

    if (!hasActiveSubscription(user)) {
        throw new ApiError(403, "Active subscription required to sign in and use user features.")
    }

    return respondWithUserSession(res, user, "User logged in with Google successfully")
})

const getUserProfile = asyncHandler(async (req , res ) => {
    const user = await getUserPublicProfile(req.user?._id)

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user,
                "User profile"
            )
        )
})

const getUserScores = asyncHandler(async (req, res) => {
    const scores = await Score.find({ player: req.user?._id })
        .sort({ playedAt: -1, createdAt: -1 })

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                scores,
                "User scores"
            )
        )
})

const createUserScore = asyncHandler(async (req, res) => {
    const { score, playedAt } = req.body

    const stablefordScore = validateStablefordScore(score)
    const scoreDate = validatePlayedAtDate(playedAt)

    const createdScore = await Score.create({
        player: req.user?._id,
        stablefordScore,
        totalScore: stablefordScore,
        playedAt: scoreDate
    })

    await trimUserScoresToLatestFive(req.user?._id)

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                createdScore,
                "Score added successfully"
            )
        )
})

const updateUserScore = asyncHandler(async (req, res) => {
    const { score, playedAt } = req.body
    const stablefordScore = validateStablefordScore(score)
    const scoreDate = validatePlayedAtDate(playedAt)

    const existingScore = await Score.findOne({
        _id: req.params.scoreId,
        player: req.user?._id
    })

    if (!existingScore) {
        throw new ApiError(404, "Score not found")
    }

    existingScore.stablefordScore = stablefordScore
    existingScore.totalScore = stablefordScore
    existingScore.playedAt = scoreDate

    await existingScore.save()
    await trimUserScoresToLatestFive(req.user?._id)

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                existingScore,
                "Score updated successfully"
            )
        )
})

const updateUserProfile = asyncHandler(async (req, res) => {
    const {
        name,
        handicap,
        email,
        payoutBeneficiaryName,
        payoutEmail
    } = req.body

    const user = await User.findById(req.user?._id)

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    if (name !== undefined) {
        user.name = name.trim()
    }

    if (email !== undefined) {
        const normalizedEmail = normalizeEmail(email)

        if (!normalizedEmail) {
            throw new ApiError(400, "Email is required")
        }

        const existingUser = await User.findOne({
            email: normalizedEmail,
            _id: { $ne: user._id }
        })

        if (existingUser) {
            throw new ApiError(409, "A user with this email already exists")
        }

        user.email = normalizedEmail
    }

    if (handicap !== undefined) {
        user.handicap = handicap
    }

    if ([payoutBeneficiaryName, payoutEmail].some((field) => field !== undefined)) {
        const payoutDetails = validatePayoutDetails({
            beneficiaryName: payoutBeneficiaryName !== undefined ? payoutBeneficiaryName : user.payoutDetails?.beneficiaryName,
            email: payoutEmail !== undefined ? payoutEmail : user.payoutDetails?.email,
            fallbackEmail: email !== undefined ? normalizeEmail(email) : user.email,
            fallbackBeneficiaryName: user.name
        })

        user.payoutDetails = {
            ...(user.payoutDetails || {}),
            beneficiaryName: payoutDetails.beneficiaryName,
            email: payoutDetails.email
        }
    }

    if (req.file) {
        user.avatar = await uploadAvatarIfPresent(req, "users/avatar")
    }

    await user.save()

    const updatedUser = await getUserPublicProfile(user._id)

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updatedUser,
                "User profile updated Successfully"
            )
        )
})

const createUserWinnerPayoutSetupLink = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?._id)

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    const clientAppUrl = getClientAppUrl(req)
    const returnUrl = `${clientAppUrl}/profile/winnings?payoutSetup=success`
    const refreshUrl = `${clientAppUrl}/profile/winnings?payoutSetup=retry`

    const payoutSetup = await createWinnerPayoutSetupLink(user, {
        returnUrl,
        refreshUrl
    })

    const updatedUser = await getUserPublicProfile(user._id)

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    url: payoutSetup.url,
                    expiresAt: payoutSetup.expiresAt,
                    recipientId: payoutSetup.recipientId,
                    user: updatedUser
                },
                payoutSetup.message
            )
        )
})

const getUserDrawResults = asyncHandler(async (req, res) => {
    const draws = await Draw.find({
        status: "published",
        publishedResult: { $exists: true }
    })
        .sort({ publishedAt: -1, drawMonth: -1 })
        .limit(6)
        .select("drawMonth publishedAt publishedResult rolloverToNextMonth")

    const userId = String(req.user?._id)
    const drawResults = draws.map((draw) => {
        const userResult = draw.publishedResult?.winners?.find((winner) => String(winner.userId) === userId)

        return {
            drawMonth: draw.drawMonth,
            publishedAt: draw.publishedAt,
            winningNumbers: draw.publishedResult?.winningNumbers || [],
            rolloverToNextMonth: draw.rolloverToNextMonth || draw.publishedResult?.rolloverToNextMonth || 0,
            totalEligiblePlayers: draw.publishedResult?.eligiblePlayers || 0,
            summary: {
                threeMatchWinners: draw.publishedResult?.matchCounts?.three || 0,
                fourMatchWinners: draw.publishedResult?.matchCounts?.four || 0,
                fiveMatchWinners: draw.publishedResult?.matchCounts?.five || 0,
                totalPayout: draw.publishedResult?.payout?.total || 0
            },
            userResult: userResult
                ? {
                    matchCount: userResult.matchCount,
                    matchedNumbers: userResult.matchedNumbers || [],
                    ticketNumbers: userResult.ticketNumbers || [],
                    prizeAmount: userResult.prizeAmount || 0
                }
                : {
                    matchCount: 0,
                    matchedNumbers: [],
                    ticketNumbers: [],
                    prizeAmount: 0
                }
        }
    })

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                drawResults,
                "Published draw results"
            )
        )
})

const updateUserPassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
        throw new ApiError(400, "Current password and new password are required")
    }

    if (String(newPassword).trim().length < 6) {
        throw new ApiError(400, "New password must be at least 6 characters long")
    }

    const user = await User.findById(req.user?._id)

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    if (!user.password) {
        throw new ApiError(400, "Password sign in is not enabled for this Google account")
    }

    const isPasswordValid = await user.ispasswordCorrect(currentPassword)

    if (!isPasswordValid) {
        throw new ApiError(401, "Current password is incorrect")
    }

    user.password = newPassword.trim()
    await user.save()

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Password updated successfully"
            )
        )
})

const getAvailableCharities = asyncHandler(async (_, res) => {
    const charities = await Charity.find().sort({ name: 1 })

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                charities,
                "Charities fetched successfully"
            )
        )
})

const updateUserCharityPreference = asyncHandler(async (req, res) => {
    const { charityId, contributionPercentage } = req.body

    const user = await User.findById(req.user?._id)

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    const parsedContribution = Number(contributionPercentage)

    if (!Number.isFinite(parsedContribution) || parsedContribution < 10 || parsedContribution > 100) {
        throw new ApiError(400, "Contribution percentage must be between 10 and 100")
    }

    if (charityId) {
        const charity = await Charity.findById(charityId)

        if (!charity) {
            throw new ApiError(404, "Selected charity not found")
        }

        user.preferredCharity = charity._id
    } else {
        user.preferredCharity = undefined
    }

    user.charityContributionPercentage = parsedContribution
    await user.save()

    const updatedUser = await getUserPublicProfile(user._id)

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updatedUser,
                "Charity preference updated successfully"
            )
        )
})

const uploadWinnerProof = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?._id)

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    const normalizedPayoutStatus = normalizePayoutStatus(user.payoutStatus)

    if (Number(user.totalWinnings || 0) <= 0 || normalizedPayoutStatus !== "pending") {
        throw new ApiError(403, "Winner proof upload is available only for winners with a pending payout")
    }

    if (!req.file) {
        throw new ApiError(400, "Winner proof file is required")
    }

    if (!["image/png", "image/jpeg", "image/webp"].includes(req.file.mimetype)) {
        throw new ApiError(400, "Please upload a screenshot in PNG, JPG, or WEBP format")
    }

    const uploadedProof = await uploadOnCloudinary(req.file.path, "users/winner-proof")

    if (!uploadedProof?.secure_url) {
        throw new ApiError(500, "Something went wrong while uploading winner proof")
    }

    user.winnerProof = {
        proofUrl: uploadedProof.secure_url,
        status: "pending",
        uploadedAt: new Date(),
        reviewedAt: undefined,
        reviewNotes: ""
    }

    await user.save()

    const updatedUser = await getUserPublicProfile(user._id)

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updatedUser,
                "Winner proof uploaded successfully"
            )
        )
})

const logoutUser = asyncHandler(async (req, res) => {
    const token = req.cookies?.authtoken || req.header("Authorization")?.replace("Bearer ", "")

    if (token) {
        await blackListTokenModel.create({ token });
    }

    const options = getCookieOptions()

    return res
        .status(200)
        .clearCookie("authtoken", options)
        .json(new ApiResponse(200, {}, "User logged Out"))
})

export {
    createSubscriptionCheckoutSession,
    createGoogleSubscriptionCheckoutSession,
    confirmSubscriptionCheckout,
    loginUser,
    googleLoginUser,
    logoutUser,
    getUserProfile,
    updateUserProfile,
    updateUserPassword,
    getAvailableCharities,
    updateUserCharityPreference,
    uploadWinnerProof,
    createUserWinnerPayoutSetupLink,
    getUserDrawResults,
    getUserScores,
    createUserScore,
    updateUserScore
}
