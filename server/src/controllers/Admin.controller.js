import { Admin } from '../modules/Admin.module.js'
import { User } from '../modules/user.module.js'
import { asyncHandler } from '../utils/AsyncHanddler.js'
import { ApiError } from '../utils/Apierror.js'
import { ApiResponse } from '../utils/Apiresponse.js'
import { blackListTokenModel } from '../modules/blacklist.module.js'
import { uploadOnCloudinary } from '../utils/Cloudinary.js'
import { Score } from '../modules/Score.module.js'
import { Charity } from '../modules/Charities.module.js'
// import { Donation } from '../modules/Donation.module.js'
import { Payment } from '../modules/Payment.module.js'
import { Draw } from '../modules/Draw.module.js'
import { getSubscriptionPlanConfig } from '../constants/subscriptionPlans.js'
import { getDrawMonthKey, getStartOfDrawMonth, simulateDraw } from '../utils/drawEngine.js'
import { applyNormalizedWinnerState, normalizePayoutStatus, normalizeWinnerProofStatus } from '../utils/winnerState.js'
import { verifyGoogleToken } from '../utils/googleAuth.js'
import {
    attemptAutomaticWinnerPayout,
    buildWinnerReferenceId,
    isWinnerPayoutConfigured,
    normalizePayoutPhone,
    normalizePayoutVpa,
    syncLatestUserPayout
} from '../utils/winnerPayout.js'

const getAdminPublicProfile = (userId) => Admin.findOne({ userId }).populate({
    path: "userId",
    select: "-password"
})

const getCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax"
})

const respondWithAdminSession = async (res, user, message, statusCode = 200) => {
    const loggedInAdmin = await getAdminPublicProfile(user._id)

    if (!loggedInAdmin) {
        throw new ApiError(404, "Admin profile does not exist")
    }

    const token = user.generateAuthToken()
    const options = getCookieOptions()

    return res
        .status(statusCode)
        .cookie("authtoken", token, options)
        .json(new ApiResponse(statusCode, { admin: loggedInAdmin, token }, message))
}

const parsePermissionValue = (value) => {
    if (typeof value === "boolean") return value
    if (typeof value === "string") return value.toLowerCase() === "true"
    return false
}

const DRAW_LOGIC_MODES = ['random', 'algorithmic']
const ALGORITHMIC_PREFERENCES = ['most_frequent', 'least_frequent']

const parseDrawAmount = (value, fieldName, fallback) => {
    if (value === undefined) return fallback
    const parsedValue = Number(value)
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
        throw new ApiError(400, `${fieldName} must be a non-negative number`)
    }
    return parsedValue
}

const parseSimulationRuns = (value, fallback = 100) => {
    if (value === undefined) return fallback
    const parsedValue = Number(value)
    if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 500) {
        throw new ApiError(400, 'Simulation runs must be an integer between 1 and 500')
    }
    return parsedValue
}

const parseWinnerPayoutStatus = (value) => {
    if (value === undefined) return undefined
    const normalizedValue = normalizePayoutStatus(value)
    if (normalizedValue === undefined && value !== '' && value !== null) {
        throw new ApiError(400, 'Payout status must be pending or paid')
    }
    return normalizedValue
}

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()
const normalizeBeneficiaryName = (value) => String(value || '').trim()
const hasDrawWinners = (result) =>
    Number(result?.matchCounts?.three || 0) +
    Number(result?.matchCounts?.four || 0) +
    Number(result?.matchCounts?.five || 0) > 0

const ensureAdminGoogleAccess = (userLikeRecord) => {
    if (!userLikeRecord) {
        return
    }

    if (userLikeRecord.role !== "admin") {
        throw new ApiError(403, "This Google account is linked to a user profile. Please continue through user sign in.")
    }
}

const getManualPayoutRecipientDetails = (user) => {
    const beneficiaryName = normalizeBeneficiaryName(user?.payoutDetails?.beneficiaryName) || normalizeBeneficiaryName(user?.name)
    const phone = normalizePayoutPhone(user?.payoutDetails?.phone)
    const vpa = normalizePayoutVpa(user?.payoutDetails?.vpa)

    return {
        beneficiaryName,
        phone,
        vpa
    }
}

const uploadAvatarIfPresent = async (req, folder, fallbackAvatar = "") => {
    if (!req.file) return fallbackAvatar
    const uploadedAvatar = await uploadOnCloudinary(req.file.path, folder)
    if (!uploadedAvatar?.secure_url) {
        throw new ApiError(500, "Something went wrong while uploading avatar")
    }
    return uploadedAvatar.secure_url
}

const linkGoogleIdentityToAdmin = async (user, googleProfile) => {
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

    if (hasChanges) await user.save()
    return user
}

const getCarryOverForMonth = async (drawMonth) => {
    const previousPublishedDraw = await Draw.findOne({
        status: 'published',
        drawMonth: { $lt: drawMonth }
    }).sort({ drawMonth: -1 })

    return previousPublishedDraw?.rolloverToNextMonth || 0
}

const getCurrentMonthlyDraw = async () => {
    const drawMonth = getDrawMonthKey()
    let draw = await Draw.findOne({ drawMonth })

    if (draw) return draw

    draw = await Draw.create({
        drawMonth,
        scheduledFor: getStartOfDrawMonth(drawMonth),
        carryOverFromPrevious: await getCarryOverForMonth(drawMonth)
    })

    return draw
}

const applyDrawConfiguration = (draw, payload = {}) => {
    if (draw.status === 'published') {
        throw new ApiError(400, 'This monthly draw has already been published and can no longer be edited')
    }

    let hasChanges = false

    if (payload.logicMode !== undefined) {
        if (!DRAW_LOGIC_MODES.includes(payload.logicMode)) {
            throw new ApiError(400, 'A valid draw logic mode is required')
        }
        if (draw.logicMode !== payload.logicMode) {
            draw.logicMode = payload.logicMode
            hasChanges = true
        }
    }

    if (payload.algorithmicPreference !== undefined) {
        if (!ALGORITHMIC_PREFERENCES.includes(payload.algorithmicPreference)) {
            throw new ApiError(400, 'A valid algorithmic preference is required')
        }
        if (draw.algorithmicPreference !== payload.algorithmicPreference) {
            draw.algorithmicPreference = payload.algorithmicPreference
            hasChanges = true
        }
    }

    const nextFiveMatchJackpot = parseDrawAmount(payload.fiveMatchJackpot, '5-match jackpot', draw.prizeConfig?.fiveMatchJackpot || 0)
    const nextFourMatchPrize = parseDrawAmount(payload.fourMatchPrize, '4-match prize', draw.prizeConfig?.fourMatchPrize || 0)
    const nextThreeMatchPrize = parseDrawAmount(payload.threeMatchPrize, '3-match prize', draw.prizeConfig?.threeMatchPrize || 0)

    if (
        nextFiveMatchJackpot !== draw.prizeConfig?.fiveMatchJackpot ||
        nextFourMatchPrize !== draw.prizeConfig?.fourMatchPrize ||
        nextThreeMatchPrize !== draw.prizeConfig?.threeMatchPrize
    ) {
        draw.prizeConfig = {
            fiveMatchJackpot: nextFiveMatchJackpot,
            fourMatchPrize: nextFourMatchPrize,
            threeMatchPrize: nextThreeMatchPrize
        }
        hasChanges = true
    }

    if (hasChanges) {
        draw.status = 'draft'
        draw.simulation = undefined
    }

    return hasChanges
}

const applyPublishedDrawAwards = async (draw) => {
    if (draw.awardsApplied) return draw

    const winnerAdjustments = (draw.publishedResult?.winners || []).filter((winner) => Number(winner.prizeAmount) > 0)

    if (winnerAdjustments.length) {
        await User.bulkWrite(
            winnerAdjustments.map((winner) => ({
                updateOne: {
                    filter: { _id: winner.userId },
                    update: {
                        $inc: { totalWinnings: Number(winner.prizeAmount) },
                        $set: {
                            payoutStatus: 'pending',
                            winnerProof: {
                                proofUrl: '',
                                status: 'not_submitted',
                                uploadedAt: null,
                                reviewedAt: null,
                                reviewNotes: ''
                            }
                        }
                    }
                }
            }))
        )
    }

    draw.awardsApplied = true
    await draw.save()
    return draw
}

const registerAdmin = asyncHandler(async (req, res) => {
    const { name, email, password, handicap, permissions = {}, manageUsers, manageEvents, managePayments, manageDonations } = req.body

    if ([name, email, password].some((field) => !field || field.trim() === "")) {
        throw new ApiError(400, "All fields are required")
    }

    const normalizedEmail = normalizeEmail(email)
    const existedUser = await User.findOne({ email: normalizedEmail })

    if (existedUser) {
        throw new ApiError(409, "Admin with email already exists")
    }

    const avatarUrl = await uploadAvatarIfPresent(req, "admins/avatar")
    const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: password.trim(),
        role: "admin",
        authProvider: "password",
        avatar: avatarUrl,
        handicap
    })

    await Admin.create({
        userId: user._id,
        permissions: {
            manageUsers: parsePermissionValue(permissions.manageUsers ?? manageUsers),
            manageEvents: parsePermissionValue(permissions.manageEvents ?? manageEvents),
            managePayments: parsePermissionValue(permissions.managePayments ?? managePayments),
            manageDonations: parsePermissionValue(permissions.manageDonations ?? manageDonations)
        }
    })

    return respondWithAdminSession(res, user, "Admin registered successfully", 201)
})

const googleRegisterAdmin = asyncHandler(async (req, res) => {
    const { googleToken, name, handicap, permissions = {}, manageUsers, manageEvents, managePayments, manageDonations } = req.body

    if (!googleToken || !String(googleToken).trim()) {
        throw new ApiError(400, "Google credential is required")
    }

    const googleProfile = await verifyGoogleToken(googleToken)
    const existedUser = await User.findOne({
        $or: [{ email: googleProfile.email }, { googleId: googleProfile.googleId }]
    })

    ensureAdminGoogleAccess(existedUser)

    if (existedUser) {
        throw new ApiError(409, "Admin with this Google email already exists. Please sign in instead.")
    }

    const avatarUrl = await uploadAvatarIfPresent(req, "admins/avatar", googleProfile.avatar)
    const user = await User.create({
        name: String(name || '').trim() || googleProfile.name,
        email: googleProfile.email,
        role: "admin",
        authProvider: "google",
        googleId: googleProfile.googleId,
        avatar: avatarUrl,
        handicap
    })

    await Admin.create({
        userId: user._id,
        permissions: {
            manageUsers: parsePermissionValue(permissions.manageUsers ?? manageUsers),
            manageEvents: parsePermissionValue(permissions.manageEvents ?? manageEvents),
            managePayments: parsePermissionValue(permissions.managePayments ?? managePayments),
            manageDonations: parsePermissionValue(permissions.manageDonations ?? manageDonations)
        }
    })

    return respondWithAdminSession(res, user, "Admin registered with Google successfully", 201)
})

const loginAdmin = asyncHandler(async (req, res) =>{
    const { email, password } = req.body

    if (!email || !password) {
        throw new ApiError(400, "Email and password are required")
    }

    const normalizedEmail = normalizeEmail(email)
    const user = await User.findOne({ email: normalizedEmail })

    if (!user) throw new ApiError(404, "Admin does not exist")
    if (user.role !== "admin") throw new ApiError(403, "You are not authorized as admin")
    if (!user.password) throw new ApiError(400, "This admin account uses Google sign in. Please continue with Google.")

    const isPasswordValid = await user.ispasswordCorrect(password)

    if (!isPasswordValid) throw new ApiError(401, "Invalid admin credentials")

    return respondWithAdminSession(res, user, "Admin logged In Successfully")
})

const googleLoginAdmin = asyncHandler(async (req, res) => {
    const { googleToken } = req.body
    const googleProfile = await verifyGoogleToken(googleToken)
    const user = await User.findOne({
        role: "admin",
        $or: [{ googleId: googleProfile.googleId }, { email: googleProfile.email }]
    })

    const conflictingNonAdmin = await User.findOne({
        role: { $ne: "admin" },
        $or: [{ googleId: googleProfile.googleId }, { email: googleProfile.email }]
    })

    ensureAdminGoogleAccess(conflictingNonAdmin)

    if (!user) {
        throw new ApiError(404, "Admin account not found. Please sign up first.")
    }

    await linkGoogleIdentityToAdmin(user, googleProfile)
    return respondWithAdminSession(res, user, "Admin logged in with Google successfully")
})

const getAdminProfile = asyncHandler(async (req, res) => {
    const admin = await getAdminPublicProfile(req.user?._id)
    if (!admin) throw new ApiError(404, "Admin not found")
    return res.status(200).json(new ApiResponse(200, admin, "Admin profile"))
})

const getAllAdmins = asyncHandler(async (_, res) => {
    const admins = await Admin.find().populate({ path: "userId", select: "-password" })
    return res.status(200).json(new ApiResponse(200, admins, "All admins fetched Successfully"))
})

const updateAdminPermissions = asyncHandler(async (req, res) => {
    const { adminId } = req.params
    const { manageUsers, manageEvents, managePayments, manageDonations } = req.body

    const admin = await Admin.findById(adminId)
    if (!admin) throw new ApiError(404, "Admin not found")

    if (manageUsers !== undefined) admin.permissions.manageUsers = manageUsers
    if (manageEvents !== undefined) admin.permissions.manageEvents = manageEvents
    if (managePayments !== undefined) admin.permissions.managePayments = managePayments
    if (manageDonations !== undefined) admin.permissions.manageDonations = manageDonations

    await admin.save()

    const updatedAdmin = await Admin.findById(admin._id).populate({
        path: "userId",
        select: "-password"
    })

    return res.status(200).json(new ApiResponse(200, updatedAdmin, "Admin permissions updated Successfully"))
})

const updateAdminProfile = asyncHandler(async (req, res) => {
    const { name, email, handicap } = req.body

    const user = await User.findById(req.user?._id)
    if (!user || user.role !== "admin") throw new ApiError(404, "Admin not found")

    if (name !== undefined) user.name = name.trim()

    if (email !== undefined) {
        const normalizedEmail = normalizeEmail(email)
        if (!normalizedEmail) throw new ApiError(400, "Email is required")

        const existingUser = await User.findOne({
            email: normalizedEmail,
            _id: { $ne: user._id }
        })

        if (existingUser) throw new ApiError(409, "A user with this email already exists")
        user.email = normalizedEmail
    }

    if (handicap !== undefined) user.handicap = handicap
    if (req.file) user.avatar = await uploadAvatarIfPresent(req, "admins/avatar")

    await user.save()

    const updatedAdmin = await getAdminPublicProfile(user._id)
    return res.status(200).json(new ApiResponse(200, updatedAdmin, "Admin profile updated successfully"))
})

const updateAdminPassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
        throw new ApiError(400, "Current password and new password are required")
    }
    if (String(newPassword).trim().length < 6) {
        throw new ApiError(400, "New password must be at least 6 characters long")
    }

    const user = await User.findById(req.user?._id)
    if (!user || user.role !== "admin") throw new ApiError(404, "Admin not found")
    if (!user.password) throw new ApiError(400, "Password sign in is not enabled for this Google admin account")

    const isPasswordValid = await user.ispasswordCorrect(currentPassword)
    if (!isPasswordValid) throw new ApiError(401, "Current password is incorrect")

    user.password = newPassword.trim()
    await user.save()

    return res.status(200).json(new ApiResponse(200, {}, "Admin password updated successfully"))
})

const getAdminUsers = asyncHandler(async (_, res) => {
    const users = await User.find({ role: { $ne: "admin" } })
        .populate({ path: "preferredCharity", select: "name" })
        .select("-password")
        .sort({ createdAt: -1 })

    users.forEach((user) => applyNormalizedWinnerState(user))

    return res.status(200).json(new ApiResponse(200, users, "Users fetched successfully"))
})

const updateAdminUser = asyncHandler(async (req, res) => {
    const { userId } = req.params
    const { name, email, handicap, subscriptionStatus, subscriptionPlan, payoutStatus } = req.body

    const user = await User.findById(userId)
    if (!user || user.role === "admin") throw new ApiError(404, "User not found")

    if (name !== undefined) user.name = name.trim()

    if (email !== undefined) {
        const normalizedEmail = normalizeEmail(email)
        const existingUser = await User.findOne({
            email: normalizedEmail,
            _id: { $ne: user._id }
        })

        if (existingUser) throw new ApiError(409, "A user with this email already exists")
        user.email = normalizedEmail
    }

    if (handicap !== undefined) user.handicap = handicap
    if (!user.subscription) user.subscription = {}
    if (subscriptionStatus !== undefined) user.subscription.status = subscriptionStatus

    if (subscriptionPlan !== undefined) {
        const subscriptionConfig = getSubscriptionPlanConfig(subscriptionPlan)
        if (!subscriptionConfig) throw new ApiError(400, "A valid subscription plan is required")
        user.subscription.planCode = subscriptionConfig.code
        user.subscription.billingCycle = subscriptionConfig.billingCycle
    }

    if (payoutStatus !== undefined) user.payoutStatus = parseWinnerPayoutStatus(payoutStatus)

    await user.save()

    const updatedUser = await User.findById(user._id)
        .populate({ path: "preferredCharity", select: "name" })
        .select("-password")

    applyNormalizedWinnerState(updatedUser)
    return res.status(200).json(new ApiResponse(200, updatedUser, "User updated successfully"))
})

const getAdminUserScores = asyncHandler(async (req, res) => {
    const { userId } = req.params
    const scores = await Score.find({ player: userId }).sort({ playedAt: -1, createdAt: -1 })
    return res.status(200).json(new ApiResponse(200, scores, "User scores fetched successfully"))
})

const updateAdminScore = asyncHandler(async (req, res) => {
    const { scoreId } = req.params
    const { stablefordScore, playedAt } = req.body

    const score = await Score.findById(scoreId)
    if (!score) throw new ApiError(404, "Score not found")

    if (stablefordScore !== undefined) {
        const parsedScore = Number(stablefordScore)
        if (!Number.isInteger(parsedScore) || parsedScore < 1 || parsedScore > 45) {
            throw new ApiError(400, "Score must be an integer between 1 and 45")
        }
        score.stablefordScore = parsedScore
        score.totalScore = parsedScore
    }

    if (playedAt !== undefined) {
        const parsedDate = new Date(playedAt)
        if (Number.isNaN(parsedDate.getTime())) {
            throw new ApiError(400, "A valid score date is required")
        }
        score.playedAt = parsedDate
    }

    await score.save()
    return res.status(200).json(new ApiResponse(200, score, "Score updated successfully"))
})

const getAdminCharities = asyncHandler(async (_, res) => {
    const charities = await Charity.find().sort({ name: 1 })
    return res.status(200).json(new ApiResponse(200, charities, "Charities fetched successfully"))
})

const createAdminCharity = asyncHandler(async (req, res) => {
    const { name, description, website } = req.body
    if (!name || !name.trim()) throw new ApiError(400, "Charity name is required")

    let logo = ""
    if (req.file) {
        const uploadedLogo = await uploadOnCloudinary(req.file.path, "charities/logo")
        if (!uploadedLogo?.secure_url) {
            throw new ApiError(500, "Something went wrong while uploading charity logo")
        }
        logo = uploadedLogo.secure_url
    }

    const charity = await Charity.create({
        name: name.trim(),
        description: description?.trim(),
        website: website?.trim(),
        logo
    })

    return res.status(201).json(new ApiResponse(201, charity, "Charity created successfully"))
})

const updateAdminCharity = asyncHandler(async (req, res) => {
    const { charityId } = req.params
    const { name, description, website, totalDonations } = req.body

    const charity = await Charity.findById(charityId)
    if (!charity) throw new ApiError(404, "Charity not found")

    if (name !== undefined) charity.name = name.trim()
    if (description !== undefined) charity.description = description.trim()
    if (website !== undefined) charity.website = website.trim()
    if (totalDonations !== undefined) charity.totalDonations = Number(totalDonations) || 0

    if (req.file) {
        const uploadedLogo = await uploadOnCloudinary(req.file.path, "charities/logo")
        if (!uploadedLogo?.secure_url) {
            throw new ApiError(500, "Something went wrong while uploading charity logo")
        }
        charity.logo = uploadedLogo.secure_url
    }

    await charity.save()
    return res.status(200).json(new ApiResponse(200, charity, "Charity updated successfully"))
})

const deleteAdminCharity = asyncHandler(async (req, res) => {
    const { charityId } = req.params
    const charity = await Charity.findByIdAndDelete(charityId)
    if (!charity) throw new ApiError(404, "Charity not found")
    return res.status(200).json(new ApiResponse(200, {}, "Charity deleted successfully"))
})

const getAdminCurrentDraw = asyncHandler(async (_, res) => {
    const draw = await getCurrentMonthlyDraw()
    return res.status(200).json(new ApiResponse(200, draw, 'Current monthly draw fetched successfully'))
})

const updateAdminCurrentDraw = asyncHandler(async (req, res) => {
    const draw = await getCurrentMonthlyDraw()
    applyDrawConfiguration(draw, req.body)
    await draw.save()
    return res.status(200).json(new ApiResponse(200, draw, 'Current monthly draw updated successfully'))
})

const runAdminDrawSimulation = asyncHandler(async (req, res) => {
    const draw = await getCurrentMonthlyDraw()
    applyDrawConfiguration(draw, req.body)

    const simulationRuns = parseSimulationRuns(req.body?.simulationRuns, 100)
    const simulation = await simulateDraw({
        logicMode: draw.logicMode,
        algorithmicPreference: draw.algorithmicPreference,
        prizeConfig: draw.prizeConfig,
        carryOverFromPrevious: draw.carryOverFromPrevious,
        runs: simulationRuns
    })

    draw.simulation = simulation
    draw.status = 'simulated'
    await draw.save()

    return res.status(200).json(new ApiResponse(200, draw, 'Draw simulation completed successfully'))
})

const publishAdminCurrentDraw = asyncHandler(async (req, res) => {
    const draw = await getCurrentMonthlyDraw()

    if (draw.status === 'published' && draw.awardsApplied) {
        throw new ApiError(400, 'This monthly draw has already been published')
    }

    if (draw.status === 'published' && !draw.awardsApplied) {
        const completedDraw = await applyPublishedDrawAwards(draw)
        return res.status(200).json(new ApiResponse(200, completedDraw, 'Draw awards were completed successfully'))
    }

    let publishedSource = draw.simulation

    if (!publishedSource || ((publishedSource?.eligiblePlayers || 0) > 0 && !hasDrawWinners(publishedSource))) {
        publishedSource = await simulateDraw({
            logicMode: draw.logicMode,
            algorithmicPreference: draw.algorithmicPreference,
            prizeConfig: draw.prizeConfig,
            carryOverFromPrevious: draw.carryOverFromPrevious,
            runs: 1
        })
    }

    draw.publishedResult = {
        runs: 1,
        generatedAt: publishedSource.generatedAt || new Date(),
        winningNumbers: publishedSource.winningNumbers || [],
        eligiblePlayers: publishedSource.eligiblePlayers || 0,
        matchCounts: publishedSource.matchCounts || { three: 0, four: 0, five: 0 },
        payout: publishedSource.payout || { three: 0, four: 0, five: 0, total: 0 },
        rolloverToNextMonth: publishedSource.rolloverToNextMonth || 0,
        topScoreFrequencies: publishedSource.topScoreFrequencies || [],
        winners: publishedSource.winners || []
    }
    draw.rolloverToNextMonth = draw.publishedResult.rolloverToNextMonth
    draw.status = 'published'
    draw.publishedAt = new Date()
    draw.publishedBy = req.user?._id
    draw.awardsApplied = false
    await draw.save()

    const completedDraw = await applyPublishedDrawAwards(draw)
    return res.status(200).json(new ApiResponse(200, completedDraw, 'Current monthly draw published successfully'))
})

const getAdminWinners = asyncHandler(async (_, res) => {
    const winners = await User.find({
        role: { $ne: "admin" },
        $or: [
            { totalWinnings: { $gt: 0 } },
            { "winnerProof.status": { $ne: "not_submitted" } }
        ]
    })
        .populate({ path: "preferredCharity", select: "name" })
        .select("-password")
        .sort({ updatedAt: -1 })

    await Promise.all(winners.map((winner) => syncLatestUserPayout(winner)))
    winners.forEach((winner) => applyNormalizedWinnerState(winner))
    return res.status(200).json(new ApiResponse(200, winners, "Winners fetched successfully"))
})

const updateAdminWinner = asyncHandler(async (req, res) => {
    const { userId } = req.params
    const { winnerProofStatus, payoutStatus, totalWinnings, reviewNotes } = req.body

    const user = await User.findById(userId)
    if (!user || user.role === "admin") throw new ApiError(404, "Winner not found")

    if (!user.winnerProof) {
        user.winnerProof = {
            proofUrl: '',
            status: 'not_submitted',
            uploadedAt: undefined,
            reviewedAt: undefined,
            reviewNotes: ''
        }
    }

    const nextProofStatus = winnerProofStatus !== undefined
        ? normalizeWinnerProofStatus(winnerProofStatus)
        : normalizeWinnerProofStatus(user.winnerProof?.status)

    if (winnerProofStatus !== undefined && nextProofStatus !== winnerProofStatus) {
        throw new ApiError(400, "Winner proof status is invalid")
    }

    if (totalWinnings !== undefined) user.totalWinnings = Number(totalWinnings) || 0

    const hasExplicitPayoutStatusUpdate = payoutStatus !== undefined

    let normalizedPayoutStatus = hasExplicitPayoutStatusUpdate
        ? parseWinnerPayoutStatus(payoutStatus)
        : normalizePayoutStatus(user.payoutStatus)
    const requestedPaidTransition = normalizedPayoutStatus === "paid"

    const hasOutstandingWinnings = Number(user.totalWinnings || 0) > 0

    if (!hasOutstandingWinnings) {
        user.payoutStatus = undefined
        user.winnerProof.status = "not_submitted"
        user.winnerProof.reviewedAt = undefined
        user.winnerProof.reviewNotes = ""
    } else {
        if (winnerProofStatus !== undefined) {
            user.winnerProof.status = nextProofStatus
            user.winnerProof.reviewedAt = ["approved", "rejected"].includes(nextProofStatus) ? new Date() : undefined
        }

        if (reviewNotes !== undefined) user.winnerProof.reviewNotes = String(reviewNotes).trim()

        if (normalizedPayoutStatus === "paid" && user.winnerProof.status !== "approved") {
            throw new ApiError(400, "Winner proof must be approved before marking the payout as paid")
        }

        user.payoutStatus = requestedPaidTransition ? "pending" : (normalizedPayoutStatus || "pending")

        if (requestedPaidTransition) {
            const recipientDetails = getManualPayoutRecipientDetails(user)

            if (!recipientDetails.beneficiaryName || !recipientDetails.phone || !recipientDetails.vpa) {
                throw new ApiError(
                    400,
                    "Winner payout details are incomplete. Ask the user to add beneficiary name, phone number, and UPI ID in profile settings first."
                )
            }

            if (!isWinnerPayoutConfigured()) {
                user.latestPayout = {
                    provider: "manual",
                    payoutId: undefined,
                    contactId: undefined,
                    fundAccountId: undefined,
                    amount: Number(user.totalWinnings || 0),
                    currency: "INR",
                    mode: "MANUAL_UPI",
                    status: "processed",
                    referenceId: buildWinnerReferenceId(user._id, "man"),
                    utr: undefined,
                    initiatedAt: new Date(),
                    processedAt: new Date(),
                    failureReason: "",
                    beneficiaryName: recipientDetails.beneficiaryName,
                    phone: recipientDetails.phone,
                    vpa: recipientDetails.vpa
                }
                user.payoutStatus = "paid"
            }
        }
    }

    await user.save()

    let successMessage = "Winner updated successfully"

    if (requestedPaidTransition && hasExplicitPayoutStatusUpdate) {
        if (isWinnerPayoutConfigured()) {
            try {
                const payoutAttempt = await attemptAutomaticWinnerPayout(user)
                if (payoutAttempt.message) {
                    successMessage = payoutAttempt.message
                }
            } catch (error) {
                successMessage = error?.message || "Winner update saved, but Razorpay payout could not be completed right now."
            }
        } else {
            successMessage = "Winner marked as paid manually (RazorpayX is not configured on server)."
        }
    }

    if (
        !requestedPaidTransition &&
        Number(user.totalWinnings || 0) > 0 &&
        user.winnerProof.status === "approved" &&
        user.payoutStatus !== "paid"
    ) {
        try {
            const payoutAttempt = await attemptAutomaticWinnerPayout(user)

            if (payoutAttempt.message) {
                successMessage = payoutAttempt.message
            }
        } catch (error) {
            successMessage = error?.message || "Winner update saved, but automatic payout could not be completed right now."
        }
    }

    const updatedUser = await User.findById(user._id)
        .populate({ path: "preferredCharity", select: "name" })
        .select("-password")

    await syncLatestUserPayout(updatedUser)
    applyNormalizedWinnerState(updatedUser)
    return res.status(200).json(new ApiResponse(200, updatedUser, successMessage))
})

const getAdminReports = asyncHandler(async (_, res) => {
    const [totalUsers, users, charities, donations, completedPayments, totalScores] = await Promise.all([
        User.countDocuments({ role: { $ne: "admin" } }),
        User.find({ role: { $ne: "admin" } }).select("totalWinnings winnerProof payoutStatus"),
        Charity.find().select("totalDonations"),
        Donation.find().select("amount"),
        Payment.find({ paymentStatus: "completed" }).select("amount paymentFor"),
        Score.countDocuments()
    ])

    const totalPrizePool = users.reduce((sum, user) => sum + (user.totalWinnings || 0), 0)
    const charityContributionTotals =
        charities.reduce((sum, charity) => sum + (charity.totalDonations || 0), 0) +
        donations.reduce((sum, donation) => sum + (donation.amount || 0), 0)
    const completedSubscriptionRevenue = completedPayments
        .filter((payment) => payment.paymentFor === "subscription")
        .reduce((sum, payment) => sum + (payment.amount || 0), 0)
    const proofPendingCount = users.filter((user) => user.winnerProof?.status === "pending").length
    const payoutsCompleted = users.filter((user) => normalizePayoutStatus(user.payoutStatus) === "paid").length

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                totalUsers,
                totalPrizePool,
                charityContributionTotals,
                drawStatistics: {
                    totalScores,
                    proofPendingCount,
                    payoutsCompleted,
                    completedSubscriptionRevenue
                }
            },
            "Admin reports fetched successfully"
        )
    )
})

const logoutAdmin = asyncHandler(async (req, res) => {
    const token = req.cookies?.authtoken || req.header("Authorization")?.replace("Bearer ", "")

    if (token) await blackListTokenModel.create({ token })

    const options = getCookieOptions()
    return res.status(200).clearCookie("authtoken", options).json(new ApiResponse(200, {}, "Admin logged Out"))
})

export {
    registerAdmin,
    googleRegisterAdmin,
    loginAdmin,
    googleLoginAdmin,
    logoutAdmin,
    getAdminProfile,
    getAllAdmins,
    updateAdminPermissions,
    updateAdminProfile,
    updateAdminPassword,
    getAdminUsers,
    updateAdminUser,
    getAdminUserScores,
    updateAdminScore,
    getAdminCharities,
    createAdminCharity,
    updateAdminCharity,
    deleteAdminCharity,
    getAdminCurrentDraw,
    updateAdminCurrentDraw,
    runAdminDrawSimulation,
    publishAdminCurrentDraw,
    getAdminWinners,
    updateAdminWinner,
    getAdminReports
}
