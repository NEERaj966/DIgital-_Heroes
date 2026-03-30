import mongoose from "mongoose";

const leaderboardSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event"
  },

  rankings: [{
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    score: Number,

    position: Number
  }]
});

export const Leaderboard = mongoose.model("Leaderboard", leaderboardSchema);