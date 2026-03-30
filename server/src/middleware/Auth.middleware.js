import jwt from "jsonwebtoken";
import { ApiError } from "../utils/Apierror.js";
import { asyncHandler } from "../utils/AsyncHanddler.js";
import { User } from "../modules/user.module.js";
import { blackListTokenModel } from "../modules/blacklist.module.js";
import { Admin } from "../modules/Admin.module.js";
import { hasActiveSubscription } from "../constants/subscriptionPlans.js";
import { syncUserSubscriptionFromPayments } from "../utils/subscriptionAccess.js";

export const verifyJWTForUser = asyncHandler(async (req, _, next) => {
    const token =
        req.header("Authorization")?.replace("Bearer ", "") ||
        req.cookies?.authtoken;

    if (!token) {
        throw new ApiError(401, "Unauthorized request");
    }

    const isBlacklisted = await blackListTokenModel.findOne({ token });

    if (isBlacklisted) {
        throw new ApiError(401, "Token is no longer valid");
    }

    const secret = process.env.ACCESS_TOKEN_SECRET || process.env.REFRESH_TOKEN_SECRET;

    if (!secret) {
        throw new ApiError(500, "Token secret is not configured");
    }

    const decodedToken = jwt.verify(token, secret);
    const user = await User.findById(decodedToken?._id);

    if (!user) {
        throw new ApiError(401, "Invalid access token");
    }

    await syncUserSubscriptionFromPayments(user)

    req.user = user;
    next();
});

export const verifyJWTForAdmin = asyncHandler(async (req, _, next) => {
    const token =
        req.header("Authorization")?.replace("Bearer ", "") ||
        req.cookies?.authtoken;

    if (!token) {
        throw new ApiError(401, "Unauthorized request");
    }

    const isBlacklisted = await blackListTokenModel.findOne({ token });

    if (isBlacklisted) {
        throw new ApiError(401, "Token is no longer valid");
    }

    const secret = process.env.ACCESS_TOKEN_SECRET || process.env.REFRESH_TOKEN_SECRET;

    if (!secret) {
        throw new ApiError(500, "Token secret is not configured");
    }

    const decodedToken = jwt.verify(token, secret);
    const user = await User.findById(decodedToken?._id);

    if (!user) {
        throw new ApiError(401, "Invalid access token");
    }

    if (user.role !== "admin") {
        throw new ApiError(403, "Admin access required");
    }

    const admin = await Admin.findOne({ userId: user._id });

    if (!admin) {
        throw new ApiError(404, "Admin profile does not exist");
    }

    req.user = user;
    req.admin = admin;
    next();
});

export const requireActiveSubscriptionForUser = asyncHandler(async (req, _, next) => {
    if (!req.user) {
        throw new ApiError(401, "Unauthorized request");
    }

    if (!hasActiveSubscription(req.user)) {
        throw new ApiError(403, "Active subscription required to use user features.");
    }

    next();
});
