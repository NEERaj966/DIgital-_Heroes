import { User } from '../modules/user.module.js'
import { asyncHandler } from '../utils/AsyncHanddler.js'
import { ApiError } from '../utils/Apierror.js'
import { ApiResponse } from '../utils/Apiresponse.js'
import { blackListTokenModel } from '../modules/blacklist.module.js'
import { uploadOnCloudinary } from '../utils/Cloudinary.js'
import { getSubscriptionPlanConfig, hasActiveSubscription } from '../constants/subscriptionPlans.js'
import { Payment } from '../modules/Payment.module.js'
import { Draw } from '../modules/Draw.module.js'
import { createRazorpayOrder, getRazorpayKeyId, verifyRazorpaySignature } from '../utils/Razorpay.js'
import { Score } from '../modules/Score.module.js'
import { Charity } from '../modules/Charities.module.js'
import { verifyGoogleToken } from '../utils/googleAuth.js'
import { applyNormalizedWinnerState, normalizePayoutStatus } from '../utils/winnerState.js'
import { syncUserSubscriptionFromPayments } from '../utils/subscriptionAccess.js'
import {
    normalizePayoutPhone,
    normalizePayoutVpa,
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

const validatePayoutDetails = ({ beneficiaryName, phone, vpa }) => {
    const normalizedBeneficiaryName = normalizeBeneficiaryName(beneficiaryName)
    const normalizedPhone = normalizePayoutPhone(phone)
    const normalizedVpa = normalizePayoutVpa(vpa)

    if (normalizedPhone && !/^\d{10,15}$/.test(normalizedPhone)) {
        throw new ApiError(400, "Payout phone number must contain 10 to 15 digits")
    }

    if (normalizedVpa && !/^[a-z0-9.\-_]{2,256}@[a-z]{2,64}$/.test(normalizedVpa)) {
        throw new ApiError(400, "A valid UPI ID is required for automatic payouts")
    }

    return {
        beneficiaryName: normalizedBeneficiaryName,
        phone: normalizedPhone,
        vpa: normalizedVpa
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

const ensureUserPaymentRecord = async ({
    email,
    subscriptionPlan,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature
}) => {
    const subscriptionConfig = getSubscriptionPlanConfig(subscriptionPlan.trim())

    if (!subscriptionConfig) {
        throw new ApiError(400, "A valid subscription plan is required")
    }

    const paymentRecord = await Payment.findOne({
        razorpayOrderId: razorpayOrderId.trim(),
        paymentFor: "subscription",
        subscriptionPlan: subscriptionConfig.code,
        customerEmail: email
    })

    if (!paymentRecord) {
        throw new ApiError(400, "Subscription payment record not found")
    }

    if (paymentRecord.amount !== subscriptionConfig.amount || paymentRecord.currency !== subscriptionConfig.currency) {
        throw new ApiError(400, "Subscription payment does not match the selected plan")
    }

    const isValidSignature = verifyRazorpaySignature({
        orderId: razorpayOrderId.trim(),
        paymentId: razorpayPaymentId.trim(),
        signature: razorpaySignature.trim()
    })

    if (!isValidSignature) {
        paymentRecord.paymentStatus = "failed"
        await paymentRecord.save()
        throw new ApiError(400, "Unable to verify Razorpay payment signature")
    }

    return { paymentRecord, subscriptionConfig }
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

const createSubscriptionOrder = asyncHandler(async (req, res) => {
    const { name, email, subscriptionPlan } = req.body

    if ([name, email, subscriptionPlan].some((field) => !field || field.trim() === "")) {
        throw new ApiError(400, "Name, email, and subscription plan are required")
    }

    const subscriptionConfig = getSubscriptionPlanConfig(subscriptionPlan.trim())

    if (!subscriptionConfig) {
        throw new ApiError(400, "A valid subscription plan is required")
    }

    const normalizedEmail = normalizeEmail(email)
    const existedUser = await User.findOne({ email: normalizedEmail })

    if (existedUser) {
        throw new ApiError(409, "A user with this email already exists. Please sign in instead.")
    }

    const receipt = `sub_${Date.now()}_${Math.floor(Math.random() * 100000)}`
    const razorpayOrder = await createRazorpayOrder({
        amount: subscriptionConfig.amount,
        currency: subscriptionConfig.currency,
        receipt,
        notes: {
            subscriptionPlan: subscriptionConfig.code,
            customerEmail: normalizedEmail
        }
    })

    await Payment.create({
        paymentFor: "subscription",
        subscriptionPlan: subscriptionConfig.code,
        amount: subscriptionConfig.amount,
        currency: subscriptionConfig.currency,
        paymentStatus: "pending",
        razorpayOrderId: razorpayOrder.id,
        receipt,
        customerName: name.trim(),
        customerEmail: normalizedEmail
    })

    return res.status(201).json(
        new ApiResponse(
            201,
            {
                keyId: getRazorpayKeyId(),
                order: razorpayOrder,
                subscription: subscriptionConfig
            },
            "Subscription order created successfully"
        )
    )
})

const registerUser = asyncHandler(async (req, res) => {
    const {
        name,
        email,
        password,
        role,
        handicap,
        subscriptionPlan,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
    } = req.body

    if ([name, email, password, subscriptionPlan, razorpayOrderId, razorpayPaymentId, razorpaySignature].some((field) => !field || field.trim() === "")) {
        throw new ApiError(400, "All fields are required")
    }

    const normalizedEmail = normalizeEmail(email)
    const existedUser = await User.findOne({ email: normalizedEmail })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    const { paymentRecord, subscriptionConfig } = await ensureUserPaymentRecord({
        email: normalizedEmail,
        subscriptionPlan,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
    })

    const avatarUrl = await uploadAvatarIfPresent(req, "users/avatar")

    const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: password.trim(),
        role,
        authProvider: "password",
        avatar: avatarUrl,
        handicap,
        subscription: {
            planCode: subscriptionConfig.code,
            billingCycle: subscriptionConfig.billingCycle,
            status: "active",
            subscribedAt: new Date()
        }
    })

    paymentRecord.user = user._id
    paymentRecord.paymentStatus = "completed"
    paymentRecord.transactionId = razorpayPaymentId.trim()
    paymentRecord.razorpayPaymentId = razorpayPaymentId.trim()
    await paymentRecord.save()

    return respondWithUserSession(res, user, "User registered successfully", 201)
})

const googleRegisterUser = asyncHandler(async (req, res) => {
    const {
        googleToken,
        name,
        handicap,
        subscriptionPlan,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
    } = req.body

    if ([googleToken, subscriptionPlan, razorpayOrderId, razorpayPaymentId, razorpaySignature].some((field) => !field || String(field).trim() === "")) {
        throw new ApiError(400, "Google credential, subscription plan, and payment details are required")
    }

    const googleProfile = await verifyGoogleToken(googleToken)
    const existedUser = await User.findOne({
        $or: [
            { email: googleProfile.email },
            { googleId: googleProfile.googleId }
        ]
    })

    ensureUserGoogleAccess(existedUser)

    if (existedUser) {
        throw new ApiError(409, "An account with this Google email already exists. Please sign in instead.")
    }

    const { paymentRecord, subscriptionConfig } = await ensureUserPaymentRecord({
        email: googleProfile.email,
        subscriptionPlan,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
    })

    const avatarUrl = await uploadAvatarIfPresent(req, "users/avatar", googleProfile.avatar)

    const user = await User.create({
        name: String(name || '').trim() || googleProfile.name,
        email: googleProfile.email,
        role: "player",
        authProvider: "google",
        googleId: googleProfile.googleId,
        avatar: avatarUrl,
        handicap,
        subscription: {
            planCode: subscriptionConfig.code,
            billingCycle: subscriptionConfig.billingCycle,
            status: "active",
            subscribedAt: new Date()
        }
    })

    paymentRecord.user = user._id
    paymentRecord.paymentStatus = "completed"
    paymentRecord.transactionId = razorpayPaymentId.trim()
    paymentRecord.razorpayPaymentId = razorpayPaymentId.trim()
    await paymentRecord.save()

    return respondWithUserSession(res, user, "User registered with Google successfully", 201)
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
        payoutPhone,
        payoutVpa
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

    if ([payoutBeneficiaryName, payoutPhone, payoutVpa].some((field) => field !== undefined)) {
        const payoutDetails = validatePayoutDetails({
            beneficiaryName: payoutBeneficiaryName !== undefined ? payoutBeneficiaryName : user.payoutDetails?.beneficiaryName,
            phone: payoutPhone !== undefined ? payoutPhone : user.payoutDetails?.phone,
            vpa: payoutVpa !== undefined ? payoutVpa : user.payoutDetails?.vpa
        })

        user.payoutDetails = {
            beneficiaryName: payoutDetails.beneficiaryName,
            phone: payoutDetails.phone,
            vpa: payoutDetails.vpa
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
    createSubscriptionOrder,
    registerUser,
    googleRegisterUser,
    loginUser,
    googleLoginUser,
    logoutUser,
    getUserProfile,
    updateUserProfile,
    updateUserPassword,
    getAvailableCharities,
    updateUserCharityPreference,
    uploadWinnerProof,
    getUserDrawResults,
    getUserScores,
    createUserScore,
    updateUserScore
}
