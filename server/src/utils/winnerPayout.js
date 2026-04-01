import { randomUUID } from "node:crypto";
import Stripe from "stripe";

const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
const REFERENCE_ID_MAX_LENGTH = 40;
const ZERO_DECIMAL_CURRENCIES = new Set([
    "bif",
    "clp",
    "djf",
    "gnf",
    "jpy",
    "kmf",
    "krw",
    "mga",
    "pyg",
    "rwf",
    "ugx",
    "vnd",
    "vuv",
    "xaf",
    "xof",
    "xpf"
]);

let stripeClient;

const trimValue = (value) => String(value || "").trim();
const normalizeFlagValue = (value) => trimValue(value).toLowerCase();

const getStripeSecretKey = () => trimValue(process.env.STRIPE_SECRET_KEY);
const getStripePayoutRecipientCountry = () => trimValue(process.env.STRIPE_PAYOUT_RECIPIENT_COUNTRY || "US").toUpperCase();
const getStripePayoutCurrency = () => trimValue(process.env.STRIPE_PAYOUT_CURRENCY || "USD").toLowerCase();
const getStripePayoutsEnabled = () => !["0", "false", "off", "disabled"].includes(normalizeFlagValue(process.env.STRIPE_PAYOUTS_ENABLED || "true"));

const getRequestTimeoutMs = () => {
    const timeoutFromEnv = Number(process.env.STRIPE_PAYOUT_REQUEST_TIMEOUT_MS);
    return Number.isFinite(timeoutFromEnv) && timeoutFromEnv >= 1000 ? timeoutFromEnv : DEFAULT_REQUEST_TIMEOUT_MS;
};

const getStripeClient = () => {
    if (!stripeClient) {
        const secretKey = getStripeSecretKey();

        if (!secretKey) {
            throw new Error("Stripe secret key is not configured. Set STRIPE_SECRET_KEY in server/.env.");
        }

        stripeClient = new Stripe(secretKey, {
            timeout: getRequestTimeoutMs()
        });
    }

    return stripeClient;
};

const getCurrencyExponent = (currency) => (ZERO_DECIMAL_CURRENCIES.has(trimValue(currency).toLowerCase()) ? 0 : 2);

const toMinorUnits = (amount, currency) => {
    const exponent = getCurrencyExponent(currency);
    return Math.round(Number(amount || 0) * 10 ** exponent);
};

const fromMinorUnits = (amount, currency) => {
    const exponent = getCurrencyExponent(currency);
    return Number(amount || 0) / 10 ** exponent;
};

const toDate = (value) => {
    if (!value) {
        return undefined;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? undefined : value;
    }

    const numericValue = Number(value);

    if (Number.isFinite(numericValue) && String(value).trim() !== "") {
        const milliseconds = numericValue > 1_000_000_000_000 ? numericValue : numericValue * 1000;
        const parsedNumericDate = new Date(milliseconds);
        return Number.isNaN(parsedNumericDate.getTime()) ? undefined : parsedNumericDate;
    }

    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
};

const extractStripeErrorMessage = (error) => {
    const rawMessage =
        error?.raw?.message ||
        error?.message ||
        "Unable to process the Stripe winner payout right now.";
    const message = trimValue(rawMessage);

    if (/insufficient|not enough available balance|balance/i.test(message)) {
        return "The platform Stripe balance is too low to transfer this winner prize right now.";
    }

    if (/destination|connected account|account_invalid/i.test(message)) {
        return "The winner Stripe connected account is invalid or cannot receive transfers yet.";
    }

    if (/capabilit|onboard|requirements|details_submitted|payouts_enabled/i.test(message)) {
        return "The winner must finish Stripe Connect onboarding before receiving prize transfers.";
    }

    return message;
};

const getConnectedAccountRequirements = (connectedAccount) => connectedAccount?.requirements?.currently_due || [];

const isConnectedAccountReadyForTransfers = (connectedAccount) =>
    Boolean(
        connectedAccount?.details_submitted &&
        connectedAccount?.payouts_enabled &&
        trimValue(connectedAccount?.capabilities?.transfers).toLowerCase() === "active" &&
        !getConnectedAccountRequirements(connectedAccount).length
    );

const createConnectedAccount = async ({ email, displayName, country }) => {
    const stripe = getStripeClient();

    return stripe.accounts.create({
        type: "express",
        country,
        email,
        business_type: "individual",
        capabilities: {
            transfers: {
                requested: true
            }
        },
        metadata: {
            beneficiaryName: displayName
        }
    });
};

const fetchConnectedAccount = async (accountId) => {
    const stripe = getStripeClient();
    return stripe.accounts.retrieve(accountId);
};

const createConnectedAccountLink = async ({ accountId, refreshUrl, returnUrl, isUpdate }) => {
    const stripe = getStripeClient();

    return stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: isUpdate ? "account_update" : "account_onboarding"
    });
};

const fetchTransfer = async (transferId) => {
    const stripe = getStripeClient();
    return stripe.transfers.retrieve(transferId);
};

export const transferPrizeToWinner = async (winnerStripeAccountId, amount) => {
    const stripe = getStripeClient();

    // Stripe transfers move funds from the platform balance to the winner's connected account.
    return stripe.transfers.create({
        amount,
        currency: getStripePayoutCurrency(),
        destination: trimValue(winnerStripeAccountId)
    });
};

const mapTransferToUserState = (transfer, existingState = {}) => {
    const payoutCurrency = trimValue(transfer?.currency || existingState.currency || getStripePayoutCurrency()).toUpperCase();
    const amountValue = transfer?.amount ?? toMinorUnits(existingState.amount || 0, payoutCurrency);
    const fullyReversed =
        Boolean(transfer?.reversed) ||
        (
            Number.isFinite(Number(transfer?.amount_reversed)) &&
            Number(transfer?.amount_reversed) >= Number(transfer?.amount || 0) &&
            Number(transfer?.amount || 0) > 0
        );

    return {
        provider: "stripe",
        payoutId: transfer?.id || existingState.payoutId,
        amount: fromMinorUnits(amountValue, payoutCurrency),
        currency: payoutCurrency,
        mode: "STRIPE_CONNECT_TRANSFER",
        status: fullyReversed ? "reversed" : "paid",
        referenceId: trimValue(existingState.referenceId),
        utr: trimValue(transfer?.balance_transaction || existingState.utr),
        initiatedAt: toDate(transfer?.created) || toDate(existingState.initiatedAt) || new Date(),
        processedAt: fullyReversed ? toDate(existingState.processedAt) : (toDate(transfer?.created) || toDate(existingState.processedAt) || new Date()),
        failureReason: fullyReversed ? (trimValue(existingState.failureReason) || "Stripe transfer was reversed.") : "",
        recipientId: trimValue(transfer?.destination || existingState.recipientId),
        onboardingRequired: false,
        beneficiaryName: existingState.beneficiaryName,
        phone: existingState.phone,
        vpa: existingState.vpa
    };
};

const ensureUserPayoutDetails = (user, updates = {}) => {
    user.payoutDetails = {
        beneficiaryName: trimValue(updates.beneficiaryName ?? user.payoutDetails?.beneficiaryName ?? user.name),
        email: normalizePayoutEmail(updates.email ?? user.payoutDetails?.email ?? user.email),
        phone: normalizePayoutPhone(updates.phone ?? user.payoutDetails?.phone),
        vpa: normalizePayoutVpa(updates.vpa ?? user.payoutDetails?.vpa),
        stripeRecipientId: trimValue(updates.stripeRecipientId ?? user.payoutDetails?.stripeRecipientId),
        recipientCountry: trimValue(updates.recipientCountry ?? user.payoutDetails?.recipientCountry ?? getStripePayoutRecipientCountry())
    };
};

const ensureWinnerConnectedAccount = async (user) => {
    const beneficiaryName = trimValue(user?.payoutDetails?.beneficiaryName) || trimValue(user?.name);
    const payoutEmail = normalizePayoutEmail(user?.payoutDetails?.email || user?.email);

    if (!beneficiaryName || !payoutEmail) {
        return {
            ready: false,
            message: "Winner payout details are incomplete. Add beneficiary name and payout email first."
        };
    }

    const recipientCountry = trimValue(user?.payoutDetails?.recipientCountry || getStripePayoutRecipientCountry());
    let connectedAccount;
    let createdRecipient = false;
    const existingRecipientId = trimValue(user?.payoutDetails?.stripeRecipientId);

    if (existingRecipientId) {
        try {
            connectedAccount = await fetchConnectedAccount(existingRecipientId);
        } catch (error) {
            if (error?.statusCode !== 404 && error?.code !== "resource_missing") {
                throw error;
            }
        }
    }

    if (!connectedAccount) {
        connectedAccount = await createConnectedAccount({
            email: payoutEmail,
            displayName: beneficiaryName,
            country: recipientCountry
        });
        createdRecipient = true;
    }

    ensureUserPayoutDetails(user, {
        beneficiaryName,
        email: payoutEmail,
        stripeRecipientId: connectedAccount.id,
        recipientCountry
    });

    return {
        ready: isConnectedAccountReadyForTransfers(connectedAccount),
        createdRecipient,
        recipientAccount: connectedAccount,
        beneficiaryName,
        payoutEmail
    };
};

export const normalizePayoutPhone = (value) => trimValue(value).replace(/\D/g, "");
export const normalizePayoutVpa = (value) => trimValue(value).toLowerCase();
export const normalizePayoutEmail = (value) => trimValue(value).toLowerCase();

const isWinnerPayoutSetupConfigured = () => Boolean(getStripeSecretKey()) && getStripePayoutsEnabled();

export const isWinnerPayoutConfigured = () => Boolean(getStripeSecretKey()) && getStripePayoutsEnabled();

export const buildWinnerReferenceId = (userId, prefix = "win") => {
    const sanitizedPrefix = trimValue(prefix).replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "win";
    const idTail = trimValue(userId).slice(-10).toLowerCase() || "user";
    const timePart = Date.now().toString(36);
    const randomPart = randomUUID().replace(/-/g, "").slice(0, 6);
    const rawReferenceId = `${sanitizedPrefix}_${idTail}_${timePart}${randomPart}`;
    return rawReferenceId.slice(0, REFERENCE_ID_MAX_LENGTH);
};

export const createWinnerPayoutSetupLink = async (user, { returnUrl, refreshUrl } = {}) => {
    if (!user) {
        throw new Error("Winner account was not found.");
    }

    if (!isWinnerPayoutSetupConfigured()) {
        throw new Error("Stripe Connect winner payouts are not configured on the server yet.");
    }

    const recipientState = await ensureWinnerConnectedAccount(user);

    if (!recipientState.recipientAccount?.id) {
        throw new Error(recipientState.message || "Stripe connected account could not be prepared.");
    }

    // Winners complete Connect onboarding first, then prize money is sent as a transfer from the platform balance.
    const accountLink = await createConnectedAccountLink({
        accountId: recipientState.recipientAccount.id,
        refreshUrl,
        returnUrl,
        isUpdate: !recipientState.createdRecipient
    });

    user.latestPayout = {
        provider: "stripe",
        amount: Number(user.totalWinnings || 0),
        currency: getStripePayoutCurrency().toUpperCase(),
        mode: "STRIPE_CONNECT_TRANSFER",
        status: recipientState.ready ? "ready" : "action_required",
        referenceId: user.latestPayout?.referenceId || buildWinnerReferenceId(user._id, "setup"),
        initiatedAt: user.latestPayout?.initiatedAt || new Date(),
        failureReason: recipientState.ready ? "" : "Complete Stripe Connect onboarding to receive winner prize transfers.",
        recipientId: recipientState.recipientAccount.id,
        onboardingRequired: !recipientState.ready,
        beneficiaryName: recipientState.beneficiaryName
    };
    user.payoutStatus = Number(user.totalWinnings || 0) > 0 ? "pending" : user.payoutStatus;
    await user.save();

    return {
        url: accountLink?.url,
        expiresAt: accountLink?.expires_at,
        recipientId: recipientState.recipientAccount.id,
        message: "Stripe Connect onboarding link created successfully."
    };
};

export const syncLatestUserPayout = async (user) => {
    if (!user?.latestPayout?.payoutId || user.latestPayout.provider !== "stripe" || !isWinnerPayoutConfigured()) {
        return user;
    }

    try {
        const transfer = await fetchTransfer(user.latestPayout.payoutId);
        const nextLatestPayout = {
            ...mapTransferToUserState(transfer, user.latestPayout),
            referenceId: trimValue(user.latestPayout.referenceId),
            beneficiaryName: user.latestPayout.beneficiaryName
        };
        const nextPayoutStatus = trimValue(nextLatestPayout.status).toLowerCase() === "paid" ? "paid" : "pending";
        const hasChanges =
            JSON.stringify(user.latestPayout) !== JSON.stringify(nextLatestPayout) ||
            user.payoutStatus !== nextPayoutStatus;

        if (hasChanges) {
            user.latestPayout = nextLatestPayout;
            user.payoutStatus = nextPayoutStatus;
            await user.save();
        }
    } catch {
        return user;
    }

    return user;
};

export const attemptAutomaticWinnerPayout = async (user) => {
    if (!user) {
        return {
            attempted: false,
            sent: false,
            message: "Winner account was not found."
        };
    }

    if (Number(user.totalWinnings || 0) <= 0) {
        return {
            attempted: false,
            sent: false,
            message: "No winnings are available for payout."
        };
    }

    if (user.winnerProof?.status !== "approved") {
        return {
            attempted: false,
            sent: false,
            message: "Winner proof must be approved before sending payout."
        };
    }

    if (!isWinnerPayoutConfigured()) {
        return {
            attempted: false,
            sent: false,
            message: "Stripe Connect winner payouts are not configured on the server yet."
        };
    }

    if (user.latestPayout?.payoutId && trimValue(user.latestPayout.status).toLowerCase() === "paid") {
        return {
            attempted: false,
            sent: true,
            message: "This payout has already been processed."
        };
    }

    const recipientState = await ensureWinnerConnectedAccount(user);

    if (!recipientState.ready) {
        user.latestPayout = {
            provider: "stripe",
            amount: Number(user.totalWinnings || 0),
            currency: getStripePayoutCurrency().toUpperCase(),
            mode: "STRIPE_CONNECT_TRANSFER",
            status: "action_required",
            referenceId: user.latestPayout?.referenceId || buildWinnerReferenceId(user._id, "setup"),
            initiatedAt: user.latestPayout?.initiatedAt || new Date(),
            failureReason:
                recipientState.message ||
                "Stripe Connect onboarding is incomplete. Ask the winner to finish Stripe account setup first.",
            recipientId: recipientState.recipientAccount?.id,
            onboardingRequired: true,
            beneficiaryName: recipientState.beneficiaryName
        };
        user.payoutStatus = "pending";
        await user.save();

        return {
            attempted: false,
            sent: false,
            message:
                recipientState.message ||
                "Stripe Connect onboarding is incomplete. Ask the winner to finish Stripe account setup first."
        };
    }

    const payoutCurrency = getStripePayoutCurrency();
    const amountInMinorUnits = toMinorUnits(Number(user.totalWinnings || 0), payoutCurrency);

    if (!Number.isFinite(amountInMinorUnits) || amountInMinorUnits <= 0) {
        return {
            attempted: false,
            sent: false,
            message: "Winner payout amount is invalid."
        };
    }

    const referenceId = buildWinnerReferenceId(user._id, "win");

    try {
        const transfer = await transferPrizeToWinner(recipientState.recipientAccount.id, amountInMinorUnits);

        user.latestPayout = {
            ...mapTransferToUserState(transfer, user.latestPayout),
            referenceId,
            beneficiaryName: recipientState.beneficiaryName,
            recipientId: recipientState.recipientAccount.id
        };
        user.payoutStatus = "paid";
        await user.save();

        return {
            attempted: true,
            sent: true,
            message: "Winner prize transferred successfully to the Stripe connected account."
        };
    } catch (error) {
        const failureMessage = extractStripeErrorMessage(error);

        user.latestPayout = {
            provider: "stripe",
            amount: Number(user.totalWinnings || 0),
            currency: payoutCurrency.toUpperCase(),
            mode: "STRIPE_CONNECT_TRANSFER",
            status: "failed",
            referenceId,
            initiatedAt: new Date(),
            failureReason: failureMessage,
            recipientId: recipientState.recipientAccount?.id,
            onboardingRequired: false,
            beneficiaryName: recipientState.beneficiaryName
        };
        user.payoutStatus = "pending";
        await user.save();

        return {
            attempted: true,
            sent: false,
            message: failureMessage
        };
    }
};
