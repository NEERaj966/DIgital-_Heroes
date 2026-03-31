import { randomUUID } from "node:crypto";

const STRIPE_API_BASE_URL = "https://api.stripe.com";
const STRIPE_PAYOUTS_API_VERSION = "2026-03-25.preview";
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
const REFERENCE_ID_MAX_LENGTH = 40;
const TERMINAL_PAYOUT_STATUSES = ["posted", "failed", "returned", "canceled"];
const IN_FLIGHT_PAYOUT_STATUSES = ["created", "pending", "processing", "submitted"];
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

const trimValue = (value) => String(value || "").trim();
const normalizeFlagValue = (value) => trimValue(value).toLowerCase();

const getStripeSecretKey = () => trimValue(process.env.STRIPE_SECRET_KEY);
const getStripePayoutFinancialAccountId = () => trimValue(process.env.STRIPE_PAYOUT_FINANCIAL_ACCOUNT_ID);
const getStripePayoutRecipientCountry = () => trimValue(process.env.STRIPE_PAYOUT_RECIPIENT_COUNTRY || "IN").toUpperCase();
const getStripePayoutCurrency = () => trimValue(process.env.STRIPE_PAYOUT_CURRENCY || "INR").toLowerCase();
const getStripePayoutsEnabled = () => !["0", "false", "off", "disabled"].includes(normalizeFlagValue(process.env.STRIPE_PAYOUTS_ENABLED || "true"));

const getRequestTimeoutMs = () => {
    const timeoutFromEnv = Number(process.env.STRIPE_PAYOUT_REQUEST_TIMEOUT_MS);
    return Number.isFinite(timeoutFromEnv) && timeoutFromEnv >= 1000 ? timeoutFromEnv : DEFAULT_REQUEST_TIMEOUT_MS;
};

const appendSearchParams = (url, searchParams = {}) => {
    Object.entries(searchParams).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
            return;
        }

        if (Array.isArray(value)) {
            value.forEach((item) => {
                if (item !== undefined && item !== null && item !== "") {
                    url.searchParams.append(key, String(item));
                }
            });
            return;
        }

        url.searchParams.append(key, String(value));
    });
};

const extractStripeErrorMessage = (payload, status) => {
    const message =
        payload?.error?.message ||
        payload?.error?.reason ||
        payload?.message ||
        payload?.errors?.[0]?.message ||
        `Stripe payout request failed with status ${status}`;

    if (/global payouts|public preview|preview feature/i.test(message)) {
        return "Stripe Global Payouts is not enabled for this Stripe account yet. Enable the feature in Stripe before sending winner payouts.";
    }

    if (/financial_account/i.test(message) && /missing|invalid|required/i.test(message)) {
        return "Stripe payout source account is missing. Set STRIPE_PAYOUT_FINANCIAL_ACCOUNT_ID in server/.env.";
    }

    if (/requested url was not found/i.test(message)) {
        return "Stripe Global Payouts API is not available for this Stripe account yet.";
    }

    return message;
};

const stripeRequest = async (path, { method = "GET", body, searchParams, contextId, idempotencyKey } = {}) => {
    const secretKey = getStripeSecretKey();

    if (!secretKey) {
        throw new Error("Stripe secret key is not configured. Set STRIPE_SECRET_KEY in server/.env.");
    }

    const url = new URL(path, STRIPE_API_BASE_URL);
    appendSearchParams(url, searchParams);

    const headers = {
        Authorization: `Bearer ${secretKey}`,
        "Stripe-Version": STRIPE_PAYOUTS_API_VERSION
    };

    if (body) {
        headers["Content-Type"] = "application/json";
    }

    if (contextId) {
        headers["Stripe-Context"] = contextId;
    }

    if (idempotencyKey) {
        headers["Idempotency-Key"] = idempotencyKey;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getRequestTimeoutMs());

    try {
        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal
        });

        const contentType = String(response.headers.get("content-type") || "");
        const payload = contentType.includes("application/json")
            ? await response.json().catch(() => null)
            : await response.text().catch(() => "");

        if (!response.ok) {
            const error = new Error(extractStripeErrorMessage(payload, response.status));
            error.statusCode = response.status;
            error.payload = payload;
            throw error;
        }

        return payload;
    } catch (error) {
        if (error?.name === "AbortError") {
            const timeoutError = new Error("Stripe payout request timed out. Please try again.");
            timeoutError.statusCode = 504;
            throw timeoutError;
        }

        throw error;
    } finally {
        clearTimeout(timeout);
    }
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

const getRecipientCapabilityStatus = (recipientAccount) =>
    recipientAccount?.configuration?.recipient?.capabilities?.bank_accounts?.local?.status ||
    recipientAccount?.configuration?.recipient?.capabilities?.bank_accounts?.wire?.status ||
    recipientAccount?.configuration?.recipient?.capabilities?.bank_accounts?.local ||
    recipientAccount?.configuration?.recipient?.capabilities?.bank_accounts?.wire ||
    "";

const getRecipientRequirements = (recipientAccount) => recipientAccount?.requirements?.currently_due || [];

const isRecipientReadyForPayout = (recipientAccount) =>
    Boolean(
        trimValue(recipientAccount?.configuration?.recipient?.default_outbound_destination) &&
        ["active", "enabled"].includes(trimValue(getRecipientCapabilityStatus(recipientAccount)).toLowerCase()) &&
        !getRecipientRequirements(recipientAccount).length
    );

const createRecipientAccount = async ({ email, displayName, country }) =>
    stripeRequest("/v2/core/accounts", {
        method: "POST",
        body: {
            contact_email: email,
            display_name: displayName,
            identity: {
                country,
                entity_type: "individual"
            },
            configuration: {
                recipient: {
                    capabilities: {
                        bank_accounts: {
                            local: {
                                requested: true
                            }
                        }
                    }
                }
            },
            include: ["configuration.recipient", "requirements", "identity"]
        }
    });

const fetchRecipientAccount = async (recipientId) =>
    stripeRequest(`/v2/core/accounts/${recipientId}`, {
        searchParams: {
            include: ["configuration.recipient", "requirements", "identity"]
        }
    });

const createRecipientOnboardingLink = async ({ recipientId, refreshUrl, returnUrl, isUpdate }) =>
    stripeRequest("/v2/core/account_links", {
        method: "POST",
        body: {
            account: recipientId,
            use_case: isUpdate
                ? {
                    type: "account_update",
                    account_update: {
                        configurations: ["recipient"],
                        refresh_url: refreshUrl,
                        return_url: returnUrl
                    }
                }
                : {
                    type: "account_onboarding",
                    account_onboarding: {
                        configurations: ["recipient"],
                        refresh_url: refreshUrl,
                        return_url: returnUrl
                    }
                }
        }
    });

const createOutboundPayment = async ({ recipientId, amountInMinorUnits, currency, referenceId, description }) => {
    const financialAccountId = getStripePayoutFinancialAccountId();

    if (!financialAccountId) {
        throw new Error("Stripe payout source account is missing. Set STRIPE_PAYOUT_FINANCIAL_ACCOUNT_ID in server/.env.");
    }

    return stripeRequest("/v2/money_management/outbound_payments", {
        method: "POST",
        idempotencyKey: randomUUID(),
        body: {
            from: {
                financial_account: financialAccountId,
                currency
            },
            to: {
                recipient: recipientId
            },
            amount: {
                value: amountInMinorUnits,
                currency
            },
            description,
            metadata: {
                referenceId
            }
        }
    });
};

const fetchOutboundPayment = async (payoutId) => stripeRequest(`/v2/money_management/outbound_payments/${payoutId}`);

const buildFailureReason = (payload, existingState = {}) =>
    trimValue(
        payload?.failure?.reason ||
        payload?.failure_reason ||
        payload?.return_details?.reason ||
        payload?.cancellation_details?.reason ||
        payload?.last_error?.message ||
        existingState.failureReason
    );

const mapRemotePayoutToUserState = (payload, existingState = {}) => {
    const payoutCurrency = trimValue(payload?.amount?.currency || existingState.currency || getStripePayoutCurrency()).toUpperCase();
    const amountValue =
        payload?.amount?.value ??
        payload?.amount_value ??
        toMinorUnits(existingState.amount || 0, payoutCurrency);
    const status = trimValue(payload?.status || existingState.status).toLowerCase();

    return {
        provider: "stripe",
        payoutId: payload?.id || existingState.payoutId,
        amount: fromMinorUnits(amountValue, payoutCurrency),
        currency: payoutCurrency,
        mode: "STRIPE_GLOBAL_PAYOUT",
        status: status || existingState.status,
        referenceId: trimValue(payload?.metadata?.referenceId || existingState.referenceId),
        utr: trimValue(
            payload?.tracking_details?.serial_number ||
            payload?.tracking_details?.tracking_number ||
            existingState.utr
        ),
        initiatedAt: toDate(payload?.created) || toDate(payload?.created_at) || toDate(existingState.initiatedAt) || new Date(),
        processedAt:
            status === "posted"
                ? toDate(payload?.posted_at) || toDate(payload?.updated_at) || toDate(existingState.processedAt) || new Date()
                : toDate(existingState.processedAt),
        failureReason: buildFailureReason(payload, existingState),
        recipientId: trimValue(payload?.to?.recipient || existingState.recipientId),
        onboardingRequired: false,
        beneficiaryName: existingState.beneficiaryName,
        phone: existingState.phone,
        vpa: existingState.vpa
    };
};

const isTerminalStatus = (status) => TERMINAL_PAYOUT_STATUSES.includes(trimValue(status).toLowerCase());
const isPayoutInFlight = (status) => IN_FLIGHT_PAYOUT_STATUSES.includes(trimValue(status).toLowerCase());

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

const ensureStripeRecipient = async (user) => {
    const beneficiaryName = trimValue(user?.payoutDetails?.beneficiaryName) || trimValue(user?.name);
    const payoutEmail = normalizePayoutEmail(user?.payoutDetails?.email || user?.email);

    if (!beneficiaryName || !payoutEmail) {
        return {
            ready: false,
            message: "Winner payout details are incomplete. Add beneficiary name and payout email first."
        };
    }

    const recipientCountry = trimValue(user?.payoutDetails?.recipientCountry || getStripePayoutRecipientCountry());
    let recipientAccount;
    let createdRecipient = false;
    const existingRecipientId = trimValue(user?.payoutDetails?.stripeRecipientId);

    if (existingRecipientId) {
        try {
            recipientAccount = await fetchRecipientAccount(existingRecipientId);
        } catch (error) {
            if (error?.statusCode !== 404) {
                throw error;
            }
        }
    }

    if (!recipientAccount) {
        recipientAccount = await createRecipientAccount({
            email: payoutEmail,
            displayName: beneficiaryName,
            country: recipientCountry
        });
        createdRecipient = true;
    }

    ensureUserPayoutDetails(user, {
        beneficiaryName,
        email: payoutEmail,
        stripeRecipientId: recipientAccount.id,
        recipientCountry
    });

    return {
        ready: isRecipientReadyForPayout(recipientAccount),
        createdRecipient,
        recipientAccount,
        beneficiaryName,
        payoutEmail
    };
};

export const normalizePayoutPhone = (value) => trimValue(value).replace(/\D/g, "");
export const normalizePayoutVpa = (value) => trimValue(value).toLowerCase();
export const normalizePayoutEmail = (value) => trimValue(value).toLowerCase();

const isWinnerPayoutSetupConfigured = () => Boolean(getStripeSecretKey()) && getStripePayoutsEnabled();

export const isWinnerPayoutConfigured = () =>
    Boolean(getStripeSecretKey() && getStripePayoutFinancialAccountId()) && getStripePayoutsEnabled();

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
        throw new Error("Stripe winner payouts are not configured on the server yet.");
    }

    const recipientState = await ensureStripeRecipient(user);

    if (!recipientState.recipientAccount?.id) {
        throw new Error(recipientState.message || "Stripe payout recipient could not be prepared.");
    }

    const accountLink = await createRecipientOnboardingLink({
        recipientId: recipientState.recipientAccount.id,
        refreshUrl,
        returnUrl,
        isUpdate: !recipientState.createdRecipient
    });

    user.latestPayout = {
        provider: "stripe",
        amount: Number(user.totalWinnings || 0),
        currency: getStripePayoutCurrency().toUpperCase(),
        mode: "STRIPE_GLOBAL_PAYOUT",
        status: "action_required",
        referenceId: user.latestPayout?.referenceId || buildWinnerReferenceId(user._id, "setup"),
        initiatedAt: user.latestPayout?.initiatedAt || new Date(),
        failureReason: "Complete Stripe payout setup to receive winner funds.",
        recipientId: recipientState.recipientAccount.id,
        onboardingRequired: true,
        beneficiaryName: recipientState.beneficiaryName
    };
    user.payoutStatus = Number(user.totalWinnings || 0) > 0 ? "pending" : user.payoutStatus;
    await user.save();

    return {
        url: accountLink?.url,
        expiresAt: accountLink?.expires_at,
        recipientId: recipientState.recipientAccount.id,
        message: "Stripe payout setup link created successfully."
    };
};

export const syncLatestUserPayout = async (user) => {
    if (!user?.latestPayout?.payoutId || user.latestPayout.provider !== "stripe" || !isWinnerPayoutConfigured()) {
        return user;
    }

    const currentStatus = trimValue(user.latestPayout.status).toLowerCase();

    if (isTerminalStatus(currentStatus) && user.payoutStatus === "paid") {
        return user;
    }

    try {
        const payout = await fetchOutboundPayment(user.latestPayout.payoutId);
        const nextLatestPayout = mapRemotePayoutToUserState(payout, user.latestPayout);
        const nextPayoutStatus = trimValue(payout?.status).toLowerCase() === "posted" ? "paid" : "pending";
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
            message: "Stripe winner payouts are not configured on the server yet."
        };
    }

    if (user.latestPayout?.payoutId && (isPayoutInFlight(user.latestPayout.status) || trimValue(user.latestPayout.status).toLowerCase() === "posted")) {
        return {
            attempted: false,
            sent: trimValue(user.latestPayout.status).toLowerCase() === "posted",
            message:
                trimValue(user.latestPayout.status).toLowerCase() === "posted"
                    ? "This payout has already been processed."
                    : `This payout is already ${user.latestPayout.status}.`
        };
    }

    const recipientState = await ensureStripeRecipient(user);

    if (!recipientState.ready) {
        user.latestPayout = {
            provider: "stripe",
            amount: Number(user.totalWinnings || 0),
            currency: getStripePayoutCurrency().toUpperCase(),
            mode: "STRIPE_GLOBAL_PAYOUT",
            status: "action_required",
            referenceId: user.latestPayout?.referenceId || buildWinnerReferenceId(user._id, "setup"),
            initiatedAt: user.latestPayout?.initiatedAt || new Date(),
            failureReason:
                recipientState.message ||
                "Stripe payout setup is incomplete. Ask the winner to open Profile Settings or Winnings and finish Stripe payout onboarding.",
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
                "Stripe payout setup is incomplete. Ask the winner to finish Stripe payout onboarding first."
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
        const payout = await createOutboundPayment({
            recipientId: recipientState.recipientAccount.id,
            amountInMinorUnits,
            currency: payoutCurrency,
            referenceId,
            description: `Winner prize for ${trimValue(user.name) || trimValue(user.email) || "player"}`
        });

        user.latestPayout = {
            ...mapRemotePayoutToUserState(payout, user.latestPayout),
            referenceId,
            beneficiaryName: recipientState.beneficiaryName,
            recipientId: recipientState.recipientAccount.id
        };
        user.payoutStatus = trimValue(payout?.status).toLowerCase() === "posted" ? "paid" : "pending";
        await user.save();

        const isPaid = trimValue(payout?.status).toLowerCase() === "posted";
        return {
            attempted: true,
            sent: isPaid,
            message: isPaid
                ? "Winner payout processed successfully through Stripe."
                : `Winner payout started successfully through Stripe and is currently ${payout?.status || "processing"}.`
        };
    } catch (error) {
        const failureMessage = error?.message || "Unable to send the winner payout automatically through Stripe.";

        user.latestPayout = {
            provider: "stripe",
            amount: Number(user.totalWinnings || 0),
            currency: payoutCurrency.toUpperCase(),
            mode: "STRIPE_GLOBAL_PAYOUT",
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
