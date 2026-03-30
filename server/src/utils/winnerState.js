export const normalizePayoutStatus = (value) => {
    if (value === "completed") {
        return "paid";
    }

    if (value === "not_due" || value === "" || value === null) {
        return undefined;
    }

    if (value === "pending" || value === "paid") {
        return value;
    }

    return undefined;
};

export const normalizeWinnerProofStatus = (value) => {
    if (["not_submitted", "pending", "approved", "rejected"].includes(value)) {
        return value;
    }

    return "not_submitted";
};

export const applyNormalizedWinnerState = (user) => {
    if (!user) {
        return user;
    }

    const normalizedPayoutStatus = normalizePayoutStatus(user.payoutStatus);
    const hasOutstandingWinnings = Number(user.totalWinnings || 0) > 0;

    user.payoutStatus = hasOutstandingWinnings ? (normalizedPayoutStatus || "pending") : undefined;

    if (user.winnerProof) {
        user.winnerProof.status = normalizeWinnerProofStatus(user.winnerProof.status);
        user.winnerProof.reviewNotes = user.winnerProof.reviewNotes || "";
    }

    return user;
};
