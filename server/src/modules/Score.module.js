import mongoose from "mongoose";

const scoreSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event"
  },

  stablefordScore: {
    type: Number,
    required: true,
    min: 1,
    max: 45
  },

  playedAt: {
    type: Date,
    required: true
  },

  holeScores: [Number],

  totalScore: Number,

  submittedAt: {
    type: Date,
      default: Date.now
  }
},
{ timestamps: true });

export const Score = mongoose.model("Score", scoreSchema);
