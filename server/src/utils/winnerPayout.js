import { randomUUID } from "node:crypto";

const RAZORPAYX_BASE_URL = "https://api.razorpay.com/v1";
const TERMINAL_PAYOUT_STATUSES = ["processed", "failed", "cancelled", "reversed", "rejected"];
const IN_FLIGHT_PAYOUT_STATUSES = ["queued", "pending", "processing"];
const DEFAULT_RAZORPAYX_TIMEOUT_MS = 15000;
const REFERENCE_ID_MAX_LENGTH = 40;

const trimValue = (value) => String(value || "").trim();
const getRazorpayXKeyId = () => trimValue(process.env.RAZORPAYX_KEY_ID || process.env.RAZORPAY_KEY_ID);
const getRazorpayXKeySecret = () => trimValue(process.env.RAZORPAYX_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET);
const getRazorpayXSourceAccountNumber = () => trimValue(process.env.RAZORPAYX_SOURCE_ACCOUNT_NUMBER);
const shouldOmitNameField = (error) =>
    /name\s+is\/are\s+not\s+required\s+and\s+should\s+not\s+be\s+sent/i.test(trimValue(error?.message));

export const normalizePayoutPhone = (value) => {
    const digits = trimValue(value).replace(/\D/g, "");
    return digits || "";
};

export const normalizePayoutVpa = (value) => trimValue(value).toLowerCase();

export const isWinnerPayoutConfigured = () =>
    Boolean(
        getRazorpayXKeyId() &&
        getRazorpayXKeySecret() &&
        getRazorpayXSourceAccountNumber()
    );

const getAuthorizationHeader = () => {
    const keyId = getRazorpayXKeyId();
    const keySecret = getRazorpayXKeySecret();

    if (!keyId || !keySecret) {
        throw new Error("RazorpayX payout credentials are not configured. Set RAZORPAYX_KEY_ID/SECRET (or RAZORPAY_KEY_ID/SECRET).");
    }

    return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
};

const parseRazorpayXError = async (response) => {
    let payload;

    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    let message =
        payload?.error?.description ||
        payload?.error?.reason ||
        payload?.message ||
        `RazorpayX payout request failed with status ${response.status}`;

    if (/requested url was not found on the server/i.test(message)) {
        message =
            "RazorpayX payout APIs are not enabled for this account (or wrong API key set is being used). Enable RazorpayX for this account in test mode and use RazorpayX keys with a valid source account number.";
    }

    const error = new Error(message);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
};

const getRazorpayXTimeoutMs = () => {
    const timeoutFromEnv = Number(process.env.RAZORPAYX_REQUEST_TIMEOUT_MS);

    if (Number.isFinite(timeoutFromEnv) && timeoutFromEnv >= 1000) {
        return timeoutFromEnv;
    }

    return DEFAULT_RAZORPAYX_TIMEOUT_MS;
};

const razorpayXRequest = async (path, { method = "GET", body, idempotencyKey } = {}) => {
    const headers = {
        Authorization: getAuthorizationHeader(),
    };

    if (body) {
        headers["Content-Type"] = "application/json";
    }

    if (idempotencyKey) {
        headers["X-Payout-Idempotency"] = idempotencyKey;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getRazorpayXTimeoutMs());
    let response;

    try {
        response = await fetch(`${RAZORPAYX_BASE_URL}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal
        });
    } catch (error) {
        const message =
            error?.name === "AbortError"
                ? "RazorpayX payout request timed out. Please try again."
                : error?.message || "Unable to reach RazorpayX payout service.";
        const wrappedError = new Error(message);
        wrappedError.statusCode = 502;
        throw wrappedError;
    } finally {
        clearTimeout(timeout);
    }

    if (!response.ok) {
        await parseRazorpayXError(response);
    }

    return response.json();
};

const createContactRequest = async ({ name, email, phone, referenceId, includeName = true }) =>
    razorpayXRequest("/contacts", {
        method: "POST",
        body: {
            ...(includeName && name ? { name } : {}),
            email,
            contact: phone,
            type: "customer",
            reference_id: referenceId
        }
    });

const createContact = async ({ name, email, phone, referenceId }) => {
    try {
        return await createContactRequest({ name, email, phone, referenceId, includeName: true });
    } catch (error) {
        if (!shouldOmitNameField(error)) {
            throw error;
        }

        return createContactRequest({ name, email, phone, referenceId, includeName: false });
    }
};

const createVpaFundAccount = async ({ contactId, vpa }) =>
    razorpayXRequest("/fund_accounts", {
        method: "POST",
        body: {
            contact_id: contactId,
            account_type: "vpa",
            vpa: {
                address: vpa
            }
        }
    });

const createPayout = async ({ fundAccountId, amountInPaise, referenceId, notes }) =>
    razorpayXRequest("/payouts", {
        method: "POST",
        idempotencyKey: randomUUID(),
        body: {
            account_number: getRazorpayXSourceAccountNumber(),
            fund_account_id: fundAccountId,
            amount: amountInPaise,
            currency: "INR",
            mode: "UPI",
            purpose: "payout",
            queue_if_low_balance: true,
            reference_id: referenceId,
            narration: "Prize Payout",
            notes
        }
    });

const fetchPayout = async (payoutId) => razorpayXRequest(`/payouts/${payoutId}`);

const toIsoDate = (value) => {
    if (!value) {
        return undefined;
    }

    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
};

const toDateFromUnix = (value) => {
    if (!value) {
        return undefined;
    }

    const parsedDate = new Date(Number(value) * 1000);
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
};

const mapRemotePayoutToUserState = (payload, existingState = {}) => ({
    provider: "razorpayx",
    payoutId: payload?.id || existingState.payoutId,
    contactId: payload?.fund_account?.contact_id || existingState.contactId,
    fundAccountId: payload?.fund_account_id || existingState.fundAccountId,
    amount: Number(payload?.amount || existingState.amount || 0) / 100,
    currency: payload?.currency || existingState.currency || "INR",
    mode: payload?.mode || existingState.mode || "UPI",
    status: payload?.status || existingState.status,
    referenceId: payload?.reference_id || existingState.referenceId,
    utr: payload?.utr || existingState.utr,
    initiatedAt:
        toDateFromUnix(payload?.created_at) ||
        toIsoDate(existingState.initiatedAt) ||
        new Date(),
    processedAt:
        payload?.status === "processed"
            ? toDateFromUnix(payload?.status_details?.updated_at) || toDateFromUnix(payload?.processed_at) || new Date()
            : toIsoDate(existingState.processedAt),
    failureReason:
        payload?.status === "failed"
            ? payload?.status_details?.description || payload?.status_details?.reason || existingState.failureReason
            : existingState.failureReason
});

const isTerminalStatus = (status) => TERMINAL_PAYOUT_STATUSES.includes(status);

const isPayoutInFlight = (status) => IN_FLIGHT_PAYOUT_STATUSES.includes(status);

export const buildWinnerReferenceId = (userId, prefix = "win") => {
    const sanitizedPrefix = trimValue(prefix).replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "win";
    const idTail = trimValue(userId).slice(-10).toLowerCase() || "user";
    const timePart = Date.now().toString(36);
    const randomPart = randomUUID().replace(/-/g, "").slice(0, 6);
    const rawReferenceId = `${sanitizedPrefix}_${idTail}_${timePart}${randomPart}`;
    return rawReferenceId.slice(0, REFERENCE_ID_MAX_LENGTH);
};

export const syncLatestUserPayout = async (user) => {
    if (!user?.latestPayout?.payoutId || user.latestPayout.provider !== "razorpayx" || !isWinnerPayoutConfigured()) {
        return user;
    }

    const currentStatus = user.latestPayout.status;

    if (isTerminalStatus(currentStatus) && user.payoutStatus === "paid") {
        return user;
    }

    try {
        const payout = await fetchPayout(user.latestPayout.payoutId);
        const nextLatestPayout = mapRemotePayoutToUserState(payout, user.latestPayout);
        const nextPayoutStatus = payout?.status === "processed" ? "paid" : "pending";

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
            message: "Automatic payout is not configured on the server yet."
        };
    }

    const beneficiaryName = trimValue(user.payoutDetails?.beneficiaryName) || trimValue(user.name);
    const payoutPhone = normalizePayoutPhone(user.payoutDetails?.phone);
    const payoutVpa = normalizePayoutVpa(user.payoutDetails?.vpa);

    if (!beneficiaryName || !payoutPhone || !payoutVpa) {
        return {
            attempted: false,
            sent: false,
            message: "Winner payout details are incomplete. Add beneficiary name, phone number, and UPI ID first."
        };
    }

    if (user.latestPayout?.payoutId && (isPayoutInFlight(user.latestPayout.status) || user.latestPayout.status === "processed")) {
        return {
            attempted: false,
            sent: user.latestPayout.status === "processed",
            message:
                user.latestPayout.status === "processed"
                    ? "This payout has already been processed."
                    : `This payout is already ${user.latestPayout.status}.`
        };
    }

    const referenceId = buildWinnerReferenceId(user._id, "win");
    const amountInPaise = Math.round(Number(user.totalWinnings || 0) * 100);

    if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
        return {
            attempted: false,
            sent: false,
            message: "Winner payout amount is invalid."
        };
    }

    try {
        const contact = await createContact({
            name: beneficiaryName,
            email: trimValue(user.email),
            phone: payoutPhone,
            referenceId
        });

        const fundAccount = await createVpaFundAccount({
            contactId: contact.id,
            vpa: payoutVpa
        });

        const payout = await createPayout({
            fundAccountId: fundAccount.id,
            amountInPaise,
            referenceId,
            notes: {
                userId: String(user._id),
                email: trimValue(user.email),
                purpose: "winner-prize"
            }
        });

        user.latestPayout = mapRemotePayoutToUserState(
            {
                ...payout,
                fund_account_id: fundAccount.id,
                fund_account: {
                    contact_id: contact.id
                }
            },
            user.latestPayout
        );
        user.payoutStatus = payout.status === "processed" ? "paid" : "pending";
        await user.save();

        const isPaid = payout.status === "processed";
        return {
            attempted: true,
            sent: isPaid,
            message: isPaid
                ? "Winner payout processed successfully."
                : `Winner payout started successfully and is currently ${payout.status}.`
        };
    } catch (error) {
        const failureMessage = error?.message || "Unable to send the winner payout automatically.";

        try {
            user.latestPayout = {
                provider: "razorpayx",
                amount: Number(user.totalWinnings || 0),
                currency: "INR",
                mode: "UPI",
                status: "failed",
                referenceId,
                initiatedAt: new Date(),
                failureReason: failureMessage
            };
            user.payoutStatus = "pending";
            await user.save();
        } catch {
            return {
                attempted: true,
                sent: false,
                message: failureMessage
            };
        }

        return {
            attempted: true,
            sent: false,
            message: failureMessage
        };
    }
};
