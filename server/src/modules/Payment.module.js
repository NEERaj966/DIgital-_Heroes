import mongoose from "mongoose";
import { SUBSCRIPTION_PLAN_CODES } from "../constants/subscriptionPlans.js";

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event"
  },

  paymentFor: {
    type: String,
    enum: ["event", "subscription"],
    default: "event"
  },

  subscriptionPlan: {
    type: String,
    enum: SUBSCRIPTION_PLAN_CODES
  },

  amount: {
    type: Number,
    required: true
  },

  currency: {
    type: String,
    default: "INR"
  },

  paymentMethod: {
    type: String,
    default: "razorpay"
  },

  paymentStatus: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending"
  },

  transactionId: String,

  razorpayOrderId: {
    type: String,
    index: true
  },

  razorpayPaymentId: String,

  receipt: String,

  customerName: String,

  customerEmail: String,

  customerPhone: String,

  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const Payment = mongoose.model("Payment", paymentSchema);
