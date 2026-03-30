import mongoose from "mongoose";

const scoreFrequencySchema = new mongoose.Schema(
    {
        score: {
            type: Number,
            required: true
        },
        count: {
            type: Number,
            required: true,
            default: 0
        }
    },
    { _id: false }
);

const matchCountsSchema = new mongoose.Schema(
    {
        three: {
            type: Number,
            default: 0
        },
        four: {
            type: Number,
            default: 0
        },
        five: {
            type: Number,
            default: 0
        }
    },
    { _id: false }
);

const payoutSchema = new mongoose.Schema(
    {
        three: {
            type: Number,
            default: 0
        },
        four: {
            type: Number,
            default: 0
        },
        five: {
            type: Number,
            default: 0
        },
        total: {
            type: Number,
            default: 0
        }
    },
    { _id: false }
);

const drawWinnerSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        ticketNumbers: {
            type: [Number],
            default: []
        },
        matchedNumbers: {
            type: [Number],
            default: []
        },
        matchCount: {
            type: Number,
            required: true
        },
        prizeAmount: {
            type: Number,
            required: true,
            default: 0
        }
    },
    { _id: false }
);

const drawAnalysisSchema = new mongoose.Schema(
    {
        averageMatchCounts: {
            type: matchCountsSchema,
            default: () => ({})
        },
        fiveMatchHitRate: {
            type: Number,
            default: 0
        },
        averageRollover: {
            type: Number,
            default: 0
        },
        mostCommonWinningNumbers: {
            type: [scoreFrequencySchema],
            default: []
        }
    },
    { _id: false }
);

const drawResultSchema = new mongoose.Schema(
    {
        runs: {
            type: Number,
            default: 1
        },
        generatedAt: {
            type: Date
        },
        winningNumbers: {
            type: [Number],
            default: []
        },
        eligiblePlayers: {
            type: Number,
            default: 0
        },
        matchCounts: {
            type: matchCountsSchema,
            default: () => ({})
        },
        payout: {
            type: payoutSchema,
            default: () => ({})
        },
        rolloverToNextMonth: {
            type: Number,
            default: 0
        },
        topScoreFrequencies: {
            type: [scoreFrequencySchema],
            default: []
        },
        winners: {
            type: [drawWinnerSchema],
            default: []
        },
        analysis: {
            type: drawAnalysisSchema,
            default: undefined
        }
    },
    { _id: false }
);

const drawSchema = new mongoose.Schema(
    {
        drawMonth: {
            type: String,
            required: true,
            unique: true
        },
        cadence: {
            type: String,
            enum: ["monthly"],
            default: "monthly"
        },
        scheduledFor: {
            type: Date,
            required: true
        },
        status: {
            type: String,
            enum: ["draft", "simulated", "published"],
            default: "draft"
        },
        logicMode: {
            type: String,
            enum: ["random", "algorithmic"],
            default: "random"
        },
        algorithmicPreference: {
            type: String,
            enum: ["most_frequent", "least_frequent"],
            default: "most_frequent"
        },
        prizeConfig: {
            fiveMatchJackpot: {
                type: Number,
                default: 50000,
                min: 0
            },
            fourMatchPrize: {
                type: Number,
                default: 10000,
                min: 0
            },
            threeMatchPrize: {
                type: Number,
                default: 2500,
                min: 0
            }
        },
        carryOverFromPrevious: {
            type: Number,
            default: 0,
            min: 0
        },
        rolloverToNextMonth: {
            type: Number,
            default: 0,
            min: 0
        },
        simulation: {
            type: drawResultSchema,
            default: undefined
        },
        publishedResult: {
            type: drawResultSchema,
            default: undefined
        },
        publishedAt: {
            type: Date
        },
        publishedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        awardsApplied: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

export const Draw = mongoose.model("Draw", drawSchema);
