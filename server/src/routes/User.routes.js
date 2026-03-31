import { Router } from "express";
import {
  createSubscriptionCheckoutSession,
  createGoogleSubscriptionCheckoutSession,
  confirmSubscriptionCheckout,
  loginUser,
  googleLoginUser,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  updateUserPassword,
  getAvailableCharities,
  updateUserCharityPreference,
  uploadWinnerProof,
  createUserWinnerPayoutSetupLink,
  getUserDrawResults,
  getUserScores,
  createUserScore,
  updateUserScore
} from '../controllers/User.controller.js';
import { requireActiveSubscriptionForUser, verifyJWTForUser } from "../middleware/Auth.middleware.js";
import { upload } from "../middleware/Multer.middleware.js";




const router = Router();

router.route("/subscription/checkout-session").post( upload.single("avatar") , createSubscriptionCheckoutSession );
router.route("/subscription/google/checkout-session").post( upload.single("avatar") , createGoogleSubscriptionCheckoutSession );
router.route("/subscription/confirm").post( confirmSubscriptionCheckout );
router.route("/login").post( loginUser );
router.route("/google/login").post( googleLoginUser );
router.route("/charities").get( verifyJWTForUser , requireActiveSubscriptionForUser , getAvailableCharities );
router.route("/logout").get( verifyJWTForUser , logoutUser );
router.route("/userProfile").get( verifyJWTForUser , requireActiveSubscriptionForUser , getUserProfile );
router.route("/updateProfile").patch( verifyJWTForUser , requireActiveSubscriptionForUser , upload.single("avatar") , updateUserProfile );
router.route("/change-password").patch( verifyJWTForUser , requireActiveSubscriptionForUser , updateUserPassword );
router.route("/charity-preference").patch( verifyJWTForUser , requireActiveSubscriptionForUser , updateUserCharityPreference );
router.route("/winner-proof").patch( verifyJWTForUser , requireActiveSubscriptionForUser , upload.single("proof") , uploadWinnerProof );
router.route("/winner-payout/setup-link").post( verifyJWTForUser , requireActiveSubscriptionForUser , createUserWinnerPayoutSetupLink );
router.route("/draw-results").get( verifyJWTForUser , requireActiveSubscriptionForUser , getUserDrawResults );
router.route("/scores").get( verifyJWTForUser , requireActiveSubscriptionForUser , getUserScores );
router.route("/scores").post( verifyJWTForUser , requireActiveSubscriptionForUser , createUserScore );
router.route("/scores/:scoreId").patch( verifyJWTForUser , requireActiveSubscriptionForUser , updateUserScore );






export default router
