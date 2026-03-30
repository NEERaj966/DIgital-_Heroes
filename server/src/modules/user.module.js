import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import {
    SUBSCRIPTION_BILLING_CYCLES,
    SUBSCRIPTION_PLAN_CODES,
    SUBSCRIPTION_STATUSES
} from "../constants/subscriptionPlans.js";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },

        email: {
            type: String,
            required: true,
            unique: true
        },

        password: {
            type: String
        },

        authProvider: {
            type: String,
            enum: ["password", "google"],
            default: "password"
        },

        googleId: {
            type: String,
            unique: true,
            sparse: true
        },

        role: {
            type: String,
            enum: ["admin", "organizer", "player"],
            default: "player"
        },

        avatar: {
            type: String
        },

        handicap: {
            type: Number
        },

        totalDonations: {
            type: Number,
            default: 0
        },

        totalWinnings: {
            type: Number,
            default: 0
        },

        charityContributionPercentage: {
            type: Number,
            default: 10,
            min: 10,
            max: 100
        },

        preferredCharity: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Charity"
        },

        winnerProof: {
            proofUrl: {
                type: String
            },
            status: {
                type: String,
                enum: ["not_submitted", "pending", "approved", "rejected"],
                default: "not_submitted"
            },
            uploadedAt: {
                type: Date
            },
            reviewedAt: {
                type: Date
            },
            reviewNotes: {
                type: String
            }
        },

        payoutStatus: {
            type: String,
            enum: ["pending", "paid", "not_due", "completed"],
            default: undefined
        },

        payoutDetails: {
            beneficiaryName: {
                type: String
            },
            phone: {
                type: String
            },
            vpa: {
                type: String
            }
        },

        latestPayout: {
            provider: {
                type: String
            },
            payoutId: {
                type: String
            },
            contactId: {
                type: String
            },
            fundAccountId: {
                type: String
            },
            amount: {
                type: Number
            },
            currency: {
                type: String
            },
            mode: {
                type: String
            },
            status: {
                type: String
            },
            referenceId: {
                type: String
            },
            utr: {
                type: String
            },
            initiatedAt: {
                type: Date
            },
            processedAt: {
                type: Date
            },
            failureReason: {
                type: String
            },
            beneficiaryName: {
                type: String
            },
            phone: {
                type: String
            },
            vpa: {
                type: String
            }
        },

        registeredEvents: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Event"
            }
        ],

        createdEvents: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Event"
            }
        ],

        subscription: {
            planCode: {
                type: String,
                enum: SUBSCRIPTION_PLAN_CODES
            },
            billingCycle: {
                type: String,
                enum: SUBSCRIPTION_BILLING_CYCLES
            },
            status: {
                type: String,
                enum: SUBSCRIPTION_STATUSES,
                default: "inactive"
            },
            subscribedAt: {
                type: Date
            }
        },

        createdAt: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true }
);

userSchema.pre("save", async function () {
    if (!this.isModified("password") || !this.password) {
        return;
    }

    this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.ispasswordCorrect = async function (password) {
    if (!this.password) {
        return false;
    }

    return bcrypt.compare(password, this.password);
};

userSchema.methods.generateAuthToken = function () {
    const secret = process.env.ACCESS_TOKEN_SECRET || process.env.REFRESH_TOKEN_SECRET;

    if (!secret) {
        throw new Error("Token secret is not configured");
    }

    return jwt.sign(
        { _id: this._id, email: this.email },
        secret,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY || process.env.REFRESH_TOKEN_EXPIRY || "24h",
        }
    );
};

export const User = mongoose.model("User", userSchema);
