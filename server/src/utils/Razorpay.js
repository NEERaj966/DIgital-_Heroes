import crypto from "crypto";
import { ApiError } from "./Apierror.js";

const getRazorpayCredentials = () => {
    const keyId = process.env.RAZORPAY_KEY_ID || process.env.RAZORPAYX_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAYX_KEY_SECRET;

    if (!keyId || !keySecret) {
        throw new ApiError(
            500,
            "Razorpay credentials are not configured. Set RAZORPAY_KEY_ID/SECRET (or RAZORPAYX_KEY_ID/SECRET)."
        );
    }

    return { keyId, keySecret };
};

const getAuthorizationHeader = () => {
    const { keyId, keySecret } = getRazorpayCredentials();
    return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
};

export const getRazorpayKeyId = () => getRazorpayCredentials().keyId;

export const createRazorpayOrder = async ({ amount, currency, receipt, notes }) => {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
            Authorization: getAuthorizationHeader(),
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            amount,
            currency,
            receipt,
            notes
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new ApiError(response.status, data?.error?.description || "Unable to create Razorpay order");
    }

    return data;
};

export const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
    const { keySecret } = getRazorpayCredentials();

    const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

    return generatedSignature === signature;
};
