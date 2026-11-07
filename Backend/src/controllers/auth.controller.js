
import {
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

import prisma from "../db/prisma.js";
import { signAuthToken } from "../utils/authToken.js";

const ROLE_MAP = {
  CUSTOMER: "customer",
  CENTRAL_ADMIN: "central_admin",
  OUTLET_MANAGER: "outlet_manager",
};

const PHONE_REGEX = /^[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PINCODE_REGEX = /^[1-9]\d{5}$/;

const MAX_OTP_ATTEMPTS = Number(
  process.env.OTP_MAX_ATTEMPTS || 5,
);

const OTP_EXPIRY_MINUTES = Number(
  process.env.OTP_EXPIRES_MINUTES || 5,
);

const OTP_RESEND_SECONDS = Number(
  process.env.OTP_RESEND_SECONDS || 30,
);

const OTP_REQUEST_LIMIT = 5;
const OTP_REQUEST_WINDOW_MINUTES = 15;

function sendError(res, status, message, code) {
  return res.status(status).json({
    success: false,
    message,
    ...(code ? { code } : {}),
  });
}

function getOtpSecret() {
  const secret = process.env.OTP_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "OTP_SECRET must be configured and contain at least 32 characters.",
    );
  }

  return secret;
}

function normalizePhone(phone) {
  return String(phone || "").trim();
}

function hashOtp(phone, code) {
  return createHmac("sha256", getOtpSecret())
    .update(`${phone}:${code}`)
    .digest("hex");
}

function safeCompare(first, second) {
  const firstBuffer = Buffer.from(first, "hex");
  const secondBuffer = Buffer.from(second, "hex");

  return (
    firstBuffer.length === secondBuffer.length &&
    timingSafeEqual(firstBuffer, secondBuffer)
  );
}

function generateOtp() {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

function getIntent(value) {
  if (!["signup", "login", "staff"].includes(value)) {
    return null;
  }

  return value;
}

function formatUser(user, pincode = null) {
  const role = ROLE_MAP[user.role];

  return {
    id: user.id,
    phone: user.phone,
    name: user.fullName,
    email: user.email,
    role,
    pincode,
    outletId: user.managedOutlet?.id || null,
  };
}

async function getSessionUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      role: true,
      isActive: true,
      pincode,
      addresses: {
        where: { isDefault: true },
        select: { pincode: true },
        take: 1,
      },
      managedOutlet: {
        select: {
          id: true,
          isActive: true,
        },
      },
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  if (user.role === "OUTLET_MANAGER") {
    if (!user.managedOutlet || !user.managedOutlet.isActive) {
      return null;
    }
  }

  const pincode =  user.addresses[0]?.pincode ||
  user.pincode ||
  null;

  return formatUser(user, pincode);
}

/**
 * POST /api/v1/auth/otp/request
 *
 * Body:
 * {
 *   "phone": "9000000003",
 *   "intent": "login"
 * }
 *
 * Signup additionally accepts:
 * {
 *   "profile": {
 *     "name": "Customer Name",
 *     "email": "customer@example.com",
 *     "pincode": "500084"
 *   }
 * }
 */
export async function requestOtp(req, res, next) {
  try {
    const phone = normalizePhone(req.body.phone);
    const intent = getIntent(req.body.intent);

    if (!PHONE_REGEX.test(phone)) {
      return sendError(
        res,
        400,
        "Enter a valid 10-digit Indian mobile number.",
        "INVALID_PHONE",
      );
    }

    if (!intent) {
      return sendError(
        res,
        400,
        "Intent must be signup, login, or staff.",
        "INVALID_INTENT",
      );
    }

    const profile = req.body.profile || {};

    if (intent === "signup") {
      const name = String(profile.name || "").trim();
      const email = String(profile.email || "").trim().toLowerCase();
      const pincode = String(profile.pincode || "").trim();

      if (name.length < 2 || name.length > 120) {
        return sendError(
          res,
          400,
          "Enter a name between 2 and 120 characters.",
        );
      }

      if (email && !EMAIL_REGEX.test(email)) {
        return sendError(res, 400, "Enter a valid email address.");
      }

      if (!PINCODE_REGEX.test(pincode)) {
        return sendError(res, 400, "Enter a valid delivery pincode.");
      }

      // We do not let public signup create staff accounts.
      const existingUser = await prisma.user.findUnique({
        where: { phone },
        select: { id: true },
      });

      if (existingUser) {
        return sendError(
          res,
          409,
          "An account already exists for this number. Log in instead.",
          "ACCOUNT_EXISTS",
        );
      }
    }

    const existingUser = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (intent === "login") {
      if (!existingUser) {
        return sendError(
          res,
          404,
          "No account found for this number. Create an account first.",
          "NO_ACCOUNT",
        );
      }

      if (!existingUser.isActive) {
        return sendError(
          res,
          403,
          "This account is inactive.",
          "ACCOUNT_INACTIVE",
        );
      }
    }

    if (intent === "staff") {
      if (
        !existingUser ||
        !existingUser.isActive ||
        !["CENTRAL_ADMIN", "OUTLET_MANAGER"].includes(existingUser.role)
      ) {
        return sendError(
          res,
          403,
          "This number is not authorised for staff access.",
          "NOT_STAFF",
        );
      }
    }

    // Rate-limit OTP requests by phone number.
    const windowStart = new Date(
      Date.now() -
      OTP_REQUEST_WINDOW_MINUTES * 60 * 1000,
    );

    const recentRequests = await prisma.otpChallenge.count({
      where: {
        phone,
        purpose: "LOGIN",
        createdAt: { gte: windowStart },
      },
    });

    if (recentRequests >= OTP_REQUEST_LIMIT) {
      return sendError(
        res,
        429,
        "Too many OTP requests. Try again later.",
        "OTP_RATE_LIMIT",
      );
    }

    const latestChallenge = await prisma.otpChallenge.findFirst({
      where: {
        phone,
        purpose: "LOGIN",
        consumedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (latestChallenge) {
      const secondsSinceRequest =
        (Date.now() - latestChallenge.createdAt.getTime()) / 1000;

      if (secondsSinceRequest < OTP_RESEND_SECONDS) {
        return res.status(429).json({
          success: false,
          message: "Please wait before requesting another OTP.",
          retryAfterSeconds: Math.ceil(
            OTP_RESEND_SECONDS - secondsSinceRequest,
          ),
        });
      }
    }

    const otp = generateOtp();
    const expiresAt = new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
    );

    await prisma.otpChallenge.create({
      data: {
        phone,
        userId: existingUser?.id || null,
        codeHash: hashOtp(phone, otp),
        purpose: "LOGIN",
        expiresAt,
      },
    });

    /*
     * DEMO DELIVERY:
     * This project does not currently have an SMS provider integrated.
     * Return the code only in development so you can test the backend.
     * Production must send the OTP through an SMS provider and must
     * never return it in the API response.
     */
    const response = {
      success: true,
      message: "OTP generated successfully.",
      expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
      resendAfterSeconds: OTP_RESEND_SECONDS,
    };

    if (process.env.NODE_ENV !== "production") {
      response.devOtp = otp;
    }

    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/v1/auth/otp/verify
 *
 * Body:
 * {
 *   "phone": "9000000003",
 *   "otp": "123456",
 *   "intent": "login"
 * }
 *
 * Signup additionally accepts the profile.
 */
export async function verifyOtp(req, res, next) {
  try {
    const phone = normalizePhone(req.body.phone);
    const otp = String(req.body.otp || "").trim();
    const intent = getIntent(req.body.intent);
    const profile = req.body.profile || {};

    if (!PHONE_REGEX.test(phone)) {
      return sendError(res, 400, "Invalid phone number.");
    }

    if (!/^\d{6}$/.test(otp)) {
      return sendError(res, 400, "Enter a valid 6-digit OTP.");
    }

    if (!intent) {
      return sendError(res, 400, "Invalid authentication intent.");
    }

    const challenge = await prisma.otpChallenge.findFirst({
      where: {
        phone,
        purpose: "LOGIN",
        consumedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!challenge) {
      return sendError(
        res,
        400,
        "OTP not found or already used. Request a new code.",
        "OTP_NOT_FOUND",
      );
    }

    if (challenge.expiresAt <= new Date()) {
      return sendError(
        res,
        400,
        "This OTP has expired. Request a new code.",
        "OTP_EXPIRED",
      );
    }

    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      return sendError(
        res,
        429,
        "Too many incorrect attempts. Request a new code.",
        "OTP_ATTEMPTS_EXCEEDED",
      );
    }

    const suppliedHash = hashOtp(phone, otp);

    if (!safeCompare(challenge.codeHash, suppliedHash)) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts: { increment: 1 },
        },
      });

      const remaining = Math.max(
        0,
        MAX_OTP_ATTEMPTS - challenge.attempts - 1,
      );

      return sendError(
        res,
        remaining > 0 ? 400 : 429,
        remaining > 0
          ? `Incorrect OTP. ${remaining} attempts remaining.`
          : "Too many incorrect attempts. Request a new code.",
        remaining > 0 ? "BAD_OTP" : "OTP_ATTEMPTS_EXCEEDED",
      );
    }

    // Verify the account and consume the OTP in a transaction.
    const user = await prisma.$transaction(async (tx) => {
      const consumed = await tx.otpChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          attempts: { lt: MAX_OTP_ATTEMPTS },
          expiresAt: { gt: new Date() },
        },
        data: {
          consumedAt: new Date(),
        },
      });

      if (consumed.count !== 1) {
        const error = new Error(
          "This OTP has already been used or has expired.",
        );
        error.statusCode = 400;
        throw error;
      }

      let account = await tx.user.findUnique({
        where: { phone },
        include: {
          managedOutlet: {
            select: {
              id: true,
              isActive: true,
            },
          },
        },
      });

      if (intent === "signup") {
        if (account) {
          const error = new Error(
            "An account already exists for this number. Log in instead.",
          );
          error.statusCode = 409;
          throw error;
        }

        const name = String(profile.name || "").trim();
        const email = String(profile.email || "").trim().toLowerCase();
        const pincode = String(profile.pincode || "").trim();

        if (name.length < 2 || name.length > 120) {
          const error = new Error("Invalid customer name.");
          error.statusCode = 400;
          throw error;
        }

        if (!PINCODE_REGEX.test(pincode)) {
          const error = new Error("Invalid delivery pincode.");
          error.statusCode = 400;
          throw error;
        }

        if (email && !EMAIL_REGEX.test(email)) {
          const error = new Error("Invalid email address.");
          error.statusCode = 400;
          throw error;
        }

        if (email) {
          const existingEmail = await tx.user.findUnique({
            where: { email },
            select: { id: true },
          });

          if (existingEmail) {
            const error = new Error(
              "An account already uses this email address.",
            );
            error.statusCode = 409;
            throw error;
          }
        }

        account = await tx.user.create({
          data: {
            fullName: name,
            phone,
            email: email || null,
            role: "CUSTOMER",
            isActive: true,
            pincode,
            phoneVerifiedAt: new Date(),
          },
          include: {
            managedOutlet: {
              select: {
                id: true,
                isActive: true,
              },
            },
          },
        });
      } else {
        if (!account || !account.isActive) {
          const error = new Error(
            "Account not found or inactive.",
          );
          error.statusCode = 403;
          throw error;
        }

        if (intent === "staff") {
          if (
            !["CENTRAL_ADMIN", "OUTLET_MANAGER"].includes(account.role)
          ) {
            const error = new Error(
              "This number is not authorised for staff access.",
            );
            error.statusCode = 403;
            throw error;
          }
        }

        if (intent === "login" && account.role !== "CUSTOMER") {
          const error = new Error(
            "Use staff login for this account.",
          );
          error.statusCode = 403;
          throw error;
        }

        if (
          account.role === "OUTLET_MANAGER" &&
          (!account.managedOutlet || !account.managedOutlet.isActive)
        ) {
          const error = new Error(
            "No active outlet is assigned to this manager.",
          );
          error.statusCode = 403;
          throw error;
        }

        await tx.user.update({
          where: { id: account.id },
          data: {
            phoneVerifiedAt: new Date(),
          },
        });
      }

      return account;
    });

    // Resolve the profile from the database after the transaction.
    const sessionUser = await getSessionUser(user.id);

    if (!sessionUser) {
      return sendError(
        res,
        403,
        "Account is not authorised to access the application.",
      );
    }

    const token = signAuthToken(user.id);

    return res.status(200).json({
      success: true,
      message: "Authentication successful.",
      token,
      tokenType: "Bearer",
      user: sessionUser,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/v1/auth/session
 *
 * Requires authenticate middleware.
 */
export async function getCurrentSession(req, res, next) {
  try {
    const user = await getSessionUser(req.user.id);

    if (!user) {
      return sendError(
        res,
        401,
        "Your account is no longer active.",
      );
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/v1/auth/logout
 *
 * Requires authenticate middleware.
 *
 * JWT is stateless. The frontend must delete the token.
 */
export async function logout(req, res) {
  return res.status(200).json({
    success: true,
    message: "Logged out successfully. Remove the access token from the client.",
  });
}
