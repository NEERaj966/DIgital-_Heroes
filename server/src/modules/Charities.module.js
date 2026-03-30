import mongoose from "mongoose";


const charitySchema = new mongoose.Schema({
  name: String,

  description: String,

  logo: String,

  website: String,

  totalDonations: {
    type: Number,
    default: 0
  }
});

export const Charity = mongoose.model("Charity", charitySchema);