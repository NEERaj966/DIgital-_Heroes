import Stripe from "stripe";
import { ApiError } from "./Apierror.js";

let stripeClient;

const trimValue = (value) => String(value || "").trim();

const getStripeSecretKey = () => {
    const secretKey = trimValue(process.env.STRIPE_SECRET_KEY);

    if (!secretKey) {
        throw new ApiError(500, "Stripe secret key is not configured. Set STRIPE_SECRET_KEY in server/.env.");
    }

    return secretKey;
};

const getStripeClient = () => {
    if (!stripeClient) {
        stripeClient = new Stripe(getStripeSecretKey());
    }

    return stripeClient;
};

const getStripePriceMap = () => ({
    "regular-monthly": trimValue(process.env.STRIPE_PRICE_REGULAR_MONTHLY),
    "popular-monthly": trimValue(process.env.STRIPE_PRICE_POPULAR_MONTHLY),
    yearly: trimValue(process.env.STRIPE_PRICE_YEARLY)
});

export const getStripePriceId = (planCode) => {
    const priceId = getStripePriceMap()[planCode];

    if (!priceId) {
        throw new ApiError(500, `Stripe price is not configured for ${planCode}. Update STRIPE price IDs in server/.env.`);
    }

    return priceId;
};

export const createStripeSubscriptionCheckoutSession = async ({
    customerEmail,
    customerName,
    subscriptionPlan,
    userId,
    successUrl,
    cancelUrl
}) => {
    const stripe = getStripeClient();

    return stripe.checkout.sessions.create({
        mode: "subscription",
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: customerEmail,
        client_reference_id: String(userId),
        line_items: [
            {
                price: getStripePriceId(subscriptionPlan),
                quantity: 1
            }
        ],
        metadata: {
            userId: String(userId),
            subscriptionPlan,
            customerName,
            customerEmail
        },
        subscription_data: {
            metadata: {
                userId: String(userId),
                subscriptionPlan
            }
        }
    });
};

export const retrieveStripeCheckoutSession = async (sessionId) => {
    const stripe = getStripeClient();
    return stripe.checkout.sessions.retrieve(trimValue(sessionId), {
        expand: ["subscription"]
    });
};
