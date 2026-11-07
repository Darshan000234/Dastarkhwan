import { Router } from "express";
import * as auth from "../controllers/auth.controller.js";

const router = Router();
router.post("/otp/request", auth.requestOtp);
router.post("/otp/verify", auth.verifyOtp);
router.post("/token/refresh", auth.refreshToken);
router.post("/logout", auth.logout);
router.get("/session", auth.getCurrentSession);
router.post("/password/forgot", auth.requestPasswordReset);
router.post("/password/reset", auth.resetPassword);
export default router;
