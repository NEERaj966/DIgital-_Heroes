import mongoose from "mongoose";

const donationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        charity: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Charity",
            required: true
        },
        drawMonth: {
            type: String,
            required: true
        },
        grossWinningAmount: {
            type: Number,
            required: true,
            min: 0
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        netWinningAmount: {
            type: Number,
            required: true,
            min: 0
        },
        contributionPercentage: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        }
    },
    { timestamps: true }
);

export const Donation = mongoose.model("Donation", donationSchema);
