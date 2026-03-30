import mongoose from "mongoose";

const sponsorSchema = new mongoose.Schema({
  name: String,

  logo: String,

  website: String,

  sponsorshipTier: {
    type: String,
    enum: ["gold", "silver", "bronze"]
  },

  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event"
  }
});

export const Sponsor = mongoose.model("Sponsor", sponsorSchema);