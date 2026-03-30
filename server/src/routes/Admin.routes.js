import { Router } from "express";
import {
  registerAdmin,
  loginAdmin,
  googleLoginAdmin,
  googleRegisterAdmin,
  logoutAdmin,
  getAdminProfile,
  getAllAdmins,
  updateAdminPermissions,
  updateAdminProfile,
  updateAdminPassword,
  getAdminUsers,
  updateAdminUser,
  getAdminUserScores,
  updateAdminScore,
  getAdminCharities,
  createAdminCharity,
  updateAdminCharity,
  deleteAdminCharity,
  getAdminCurrentDraw,
  updateAdminCurrentDraw,
  runAdminDrawSimulation,
  publishAdminCurrentDraw,
  getAdminWinners,
  updateAdminWinner,
  getAdminReports
} from '../controllers/Admin.controller.js';
import { verifyJWTForAdmin } from "../middleware/Auth.middleware.js";
import { upload } from "../middleware/Multer.middleware.js";




const router = Router();

router.route("/register").post( upload.single("avatar") , registerAdmin );
router.route("/google/register").post( upload.single("avatar") , googleRegisterAdmin );
router.route("/login").post( loginAdmin );
router.route("/google/login").post( googleLoginAdmin );
router.route("/logout").get( verifyJWTForAdmin , logoutAdmin );
router.route("/adminProfile").get( verifyJWTForAdmin , getAdminProfile );
router.route("/updateProfile").patch( verifyJWTForAdmin , upload.single("avatar") , updateAdminProfile );
router.route("/change-password").patch( verifyJWTForAdmin , updateAdminPassword );
router.route("/allAdmins").get( verifyJWTForAdmin , getAllAdmins );
router.route("/updatePermissions/:adminId").patch( verifyJWTForAdmin , updateAdminPermissions );
router.route("/users").get( verifyJWTForAdmin , getAdminUsers );
router.route("/users/:userId").patch( verifyJWTForAdmin , updateAdminUser );
router.route("/users/:userId/scores").get( verifyJWTForAdmin , getAdminUserScores );
router.route("/scores/:scoreId").patch( verifyJWTForAdmin , updateAdminScore );
router.route("/charities").get( verifyJWTForAdmin , getAdminCharities );
router.route("/charities").post( verifyJWTForAdmin , upload.single("logo") , createAdminCharity );
router.route("/charities/:charityId").patch( verifyJWTForAdmin , upload.single("logo") , updateAdminCharity );
router.route("/charities/:charityId").delete( verifyJWTForAdmin , deleteAdminCharity );
router.route("/draws/current").get( verifyJWTForAdmin , getAdminCurrentDraw );
router.route("/draws/current").patch( verifyJWTForAdmin , updateAdminCurrentDraw );
router.route("/draws/current/simulate").post( verifyJWTForAdmin , runAdminDrawSimulation );
router.route("/draws/current/publish").post( verifyJWTForAdmin , publishAdminCurrentDraw );
router.route("/winners").get( verifyJWTForAdmin , getAdminWinners );
router.route("/winners/:userId").patch( verifyJWTForAdmin , updateAdminWinner );
router.route("/reports").get( verifyJWTForAdmin , getAdminReports );





export default router
