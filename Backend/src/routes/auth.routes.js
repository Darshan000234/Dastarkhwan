
import { Router } from "express";
import * as auth from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Public OTP endpoints.
router.post("/otp/request", auth.requestOtp);
router.post("/otp/verify", auth.verifyOtp);

// Protected session endpoint.
router.get("/session", authenticate, auth.getCurrentSession);

// Logout is client-side token deletion.
router.post("/logout", authenticate, auth.logout);

export default router;
