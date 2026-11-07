import { Router } from "express";
import * as auth from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Request an OTP for login or signup.
router.post("/otp/request", auth.requestOtp);

// Verify OTP and issue one JWT.
router.post("/otp/verify", auth.verifyOtp);

// Get the currently authenticated user.
router.get("/session", authenticate, auth.getCurrentSession);

// Logout on the client by deleting its stored token.
router.post("/logout", authenticate, auth.logout);

export default router;