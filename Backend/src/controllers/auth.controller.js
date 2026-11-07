
import {
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

import prisma from "../db/prisma.js";
import {
  signAuthToken,
  setAuthCookie,
  clearAuthCookie,
} from "../utils/authToken.js";

/* =========================================================
   CONSTANTS
========================================================= */

const ROLE_MAP = Object.freeze({
  CUSTOMER: "customer",
  CENTRAL_ADMIN: "central_admin",
  OUTLET_MANAGER: "outlet_manager",
});

const AUTH_INTENTS = new Set([
  "signup",
  "login",
  "staff",
]);

const OTP_PURPOSE = "LOGIN";

const PHONE_REGEX = /^[6-9]\d{9}$/;
const OTP_REGEX = /^\d{6}$/;
const PINCODE_REGEX = /^[1-9]\d{5}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const OTP_REQUEST_LIMIT = 5;
const OTP_REQUEST_WINDOW_MINUTES = 15;

/* =========================================================
   COMMON HELPERS
========================================================= */

function sendError(res, status, message, code) {
  return res.status(status).json({
    success: false,
    message,
    ...(code ? { code } : {}),
  });
}

function createAuthError(message, statusCode, code) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;

  return error;
}

function isPlainObject(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

function hasOnlyKeys(object, allowedKeys) {
  return Object.keys(object).every((key) =>
    allowedKeys.includes(key)
  );
}

function normalizePhone(value) {
  if (typeof value !== "string") {
    return null;
  }

  const phone = value.trim();

  return PHONE_REGEX.test(phone)
    ? phone
    : null;
}

function getIntent(value) {
  if (
    typeof value !== "string" ||
    !AUTH_INTENTS.has(value)
  ) {
    return null;
  }

  return value;
}

function getOtpConfig() {
  function readInteger(name, fallback, allowZero = false) {
    const raw = process.env[name];

    if (raw === undefined || raw === "") {
      return fallback;
    }

    const value = Number(raw);

    if (
      !Number.isSafeInteger(value) ||
      (allowZero ? value < 0 : value < 1)
    ) {
      throw new Error(
        `${name} must be a valid ${allowZero ? "non-negative" : "positive"} integer.`
      );
    }

    return value;
  }

  return {
    maxAttempts: readInteger("OTP_MAX_ATTEMPTS", 5),
    expiryMinutes: readInteger("OTP_EXPIRES_MINUTES", 5),
    resendSeconds: readInteger("OTP_RESEND_SECONDS", 30, true),
  };
}

/* =========================================================
   SIGNUP PROFILE VALIDATION
========================================================= */

function validateSignupProfile(profile) {
  if (!isPlainObject(profile)) {
    return {
      error: "A valid customer profile is required.",
    };
  }

  if (
    !hasOnlyKeys(profile, [
      "name",
      "email",
      "pincode",
    ])
  ) {
    return {
      error: "Unexpected customer profile fields.",
    };
  }

  // Name

  if (typeof profile.name !== "string") {
    return {
      error: "Customer name must be a string.",
    };
  }

  const name = profile.name.trim();

  if (
    name.length < 2 ||
    name.length > 120 ||
    /[\u0000-\u001F\u007F]/.test(name)
  ) {
    return {
      error: "Enter a valid name between 2 and 120 characters.",
    };
  }

  // Email

  let email = null;

  if (profile.email !== undefined) {
    if (typeof profile.email !== "string") {
      return {
        error: "Email must be a string.",
      };
    }

    email = profile.email.trim().toLowerCase();

    if (email.length > 255) {
      return {
        error: "Email cannot exceed 255 characters.",
      };
    }

    // Empty email is treated as optional.
    if (email === "") {
      email = null;
    } else if (!EMAIL_REGEX.test(email)) {
      return {
        error: "Enter a valid email address.",
      };
    }
  }

  // Pincode

  if (typeof profile.pincode !== "string") {
    return {
      error: "Pincode must be a string.",
    };
  }

  const pincode = profile.pincode.trim();

  if (!PINCODE_REGEX.test(pincode)) {
    return {
      error: "Enter a valid 6-digit Indian pincode.",
    };
  }

  return {
    value: {
      name,
      email,
      pincode,
    },
  };
}

/* =========================================================
   REQUEST BODY VALIDATION
========================================================= */

function validateAuthBody(body, mode) {
  if (!isPlainObject(body)) {
    return {
      error: "Invalid request body.",
    };
  }

  if (
    !hasOnlyKeys(body, [
      "phone",
      "intent",
      ...(mode === "signup" ? ["profile"] : []),
      ...(mode === "verify" ? ["otp"] : []),
    ])
  ) {
    return {
      error: "Unexpected request fields.",
    };
  }

  const phone = normalizePhone(body.phone);

  if (!phone) {
    return {
      error: "Enter a valid 10-digit Indian mobile number.",
    };
  }

  const intent = getIntent(body.intent);

  if (!intent) {
    return {
      error: "Intent must be signup, login, or staff.",
    };
  }

  let profile = null;

  if (intent === "signup") {
    const result = validateSignupProfile(body.profile);

    if (result.error) {
      return result;
    }

    profile = result.value;
  } else if (
    Object.prototype.hasOwnProperty.call(body, "profile")
  ) {
    return {
      error: "Customer profile is only accepted during signup.",
    };
  }

  let otp = null;

  if (mode === "verify") {
    if (
      typeof body.otp !== "string" ||
      !OTP_REGEX.test(body.otp)
    ) {
      return {
        error: "Enter a valid 6-digit OTP.",
      };
    }

    otp = body.otp;
  }

  return {
    value: {
      phone,
      intent,
      profile,
      otp,
    },
  };
}

/* =========================================================
   OTP CRYPTOGRAPHY
========================================================= */

function getOtpSecret() {
  const secret = process.env.OTP_SECRET;

  if (
    typeof secret !== "string" ||
    secret.length < 32
  ) {
    throw new Error(
      "OTP_SECRET must be configured with at least 32 characters."
    );
  }

  return secret;
}

function generateOtp() {
  return String(
    randomInt(0, 1000000)
  ).padStart(6, "0");
}

/*
 * The intent is included in the hash.
 *
 * Therefore:
 * - Signup OTP cannot be used for login.
 * - Customer login OTP cannot be used for staff login.
 * - Staff OTP cannot be used for customer login.
 */

function hashOtp(phone, intent, otp) {
  return createHmac("sha256", getOtpSecret())
    .update(`${phone}:${intent}:${otp}`)
    .digest("hex");
}

function safeCompare(first, second) {
  if (
    typeof first !== "string" ||
    typeof second !== "string" ||
    !/^[a-f0-9]{64}$/i.test(first) ||
    !/^[a-f0-9]{64}$/i.test(second)
  ) {
    return false;
  }

  const firstBuffer = Buffer.from(first, "hex");
  const secondBuffer = Buffer.from(second, "hex");

  return timingSafeEqual(
    firstBuffer,
    secondBuffer
  );
}

/* =========================================================
   ACCOUNT VALIDATION
========================================================= */

function validateAccountForIntent(account, intent) {
  if (!account) {
    return {
      status: intent === "staff" ? 403 : 404,
      message:
        intent === "staff"
          ? "This number is not authorised for staff access."
          : "No account found for this number.",
      code: "ACCOUNT_NOT_FOUND",
    };
  }

  if (!account.isActive) {
    return {
      status: 403,
      message: "This account is inactive.",
      code: "ACCOUNT_INACTIVE",
    };
  }

  if (intent === "login") {
    if (account.role !== "CUSTOMER") {
      return {
        status: 403,
        message: "Use staff login for this account.",
        code: "WRONG_LOGIN_INTENT",
      };
    }
  }

  if (intent === "staff") {
    if (
      ![
        "CENTRAL_ADMIN",
        "OUTLET_MANAGER",
      ].includes(account.role)
    ) {
      return {
        status: 403,
        message: "This account is not authorised for staff access.",
        code: "NOT_STAFF",
      };
    }

    if (account.role === "OUTLET_MANAGER") {
      if (
        !account.managedOutlet ||
        !account.managedOutlet.isActive
      ) {
        return {
          status: 403,
          message: "No active outlet is assigned to this manager.",
          code: "NO_ACTIVE_OUTLET",
        };
      }
    }
  }

  return null;
}

function handleControllerError(error, res, next) {
  if (error.statusCode) {
    return sendError(
      res,
      error.statusCode,
      error.message,
      error.code
    );
  }

  // Prisma unique constraint violation.
  if (error.code === "P2002") {
    const target = error.meta?.target;

    const targetText = Array.isArray(target)
      ? target.join(",")
      : String(target || "");

    if (targetText.includes("email")) {
      return sendError(
        res,
        409,
        "An account already uses this email address.",
        "EMAIL_EXISTS"
      );
    }

    return sendError(
      res,
      409,
      "An account already exists for this phone number.",
      "PHONE_EXISTS"
    );
  }

  // PostgreSQL serializable transaction conflict.
  if (error.code === "P2034") {
    return sendError(
      res,
      409,
      "This authentication request conflicted with another request. Please try again.",
      "TRANSACTION_CONFLICT"
    );
  }

  return next(error);
}

/* =========================================================
   SESSION USER
========================================================= */

function formatUser(user, pincode, serviceableOutlets = []) {
  const role = ROLE_MAP[user.role];

  return {
    id: user.id,
    phone: user.phone,
    name: user.fullName,
    email: user.email,
    role,
    pincode,

    // Customers are not permanently assigned to an outlet.
    // Manager outlet assignment comes only from the database.
    outletId:
      user.role === "OUTLET_MANAGER"
        ? user.managedOutlet.id
        : null,

    // Additive field for customer serviceability.
    // An empty array means no active outlet currently serves
    // the customer's effective pincode.
    ...(user.role === "CUSTOMER"
      ? {
          serviceableOutlets,
        }
      : {}),
  };
}

async function getSessionUser(userId) {
  if (
    typeof userId !== "string" ||
    userId.trim() === ""
  ) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      role: true,
      isActive: true,
      pincode: true,

      addresses: {
        where: {
          isDefault: true,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 1,

        select: {
          pincode: true,
        },
      },

      managedOutlet: {
        select: {
          id: true,
          isActive: true,
        },
      },
    },
  });

  if (
    !user ||
    !user.isActive ||
    !ROLE_MAP[user.role]
  ) {
    return null;
  }

  // Managers must retain an active assigned outlet.
  if (user.role === "OUTLET_MANAGER") {
    if (
      !user.managedOutlet ||
      !user.managedOutlet.isActive
    ) {
      return null;
    }
  }

  // The current default address takes precedence over
  // the pincode stored on the customer account.
  const pincode =
    user.addresses[0]?.pincode ||
    user.pincode ||
    null;

  let serviceableOutlets = [];

  if (
    user.role === "CUSTOMER" &&
    pincode
  ) {
    serviceableOutlets = await prisma.outlet.findMany({
      where: {
        isActive: true,

        OR: [
          {
            primaryPincode: pincode,
          },
          {
            deliveryPincodes: {
              has: pincode,
            },
          },
        ],
      },

      select: {
        id: true,
        name: true,
        primaryPincode: true,

        city: {
          select: {
            name: true,
          },
        },
      },

      // The schema has no outlet-priority or distance model.
      // Return all matching outlets in deterministic order.
      orderBy: [
        {
          createdAt: "asc",
        },
        {
          id: "asc",
        },
      ],
    });
  }

  return formatUser(
    user,
    pincode,
    serviceableOutlets.map((outlet) => ({
      id: outlet.id,
      name: outlet.name,
      city: outlet.city.name,
    }))
  );
}

/* =========================================================
   REQUEST OTP
   POST /api/v1/auth/otp/request
========================================================= */

export async function requestOtp(req, res, next) {
  try {
    const validation = validateAuthBody(
      req.body,
      "signup"
    );

    // Signup validation is handled conditionally.
    // Revalidate the body for login/staff without allowing profile.
    let payload;

    if (isPlainObject(req.body) && req.body.intent !== "signup") {
      const result = validateAuthBody(
        req.body,
        "request"
      );

      if (result.error) {
        return sendError(res, 400, result.error);
      }

      payload = result.value;
    } else {
      if (validation.error) {
        return sendError(res, 400, validation.error);
      }

      payload = validation.value;
    }

    const {
      phone,
      intent,
      profile,
    } = payload;

    // This project currently has no SMS delivery provider.
    // Do not create an undelivered production challenge and
    // pretend the user can authenticate.
    if (process.env.NODE_ENV === "production") {
      return sendError(
        res,
        503,
        "OTP delivery is not configured. Authentication is temporarily unavailable.",
        "OTP_DELIVERY_UNAVAILABLE"
      );
    }

    const otpConfig = getOtpConfig();

    const existingUser = await prisma.user.findUnique({
      where: {
        phone,
      },

      select: {
        id: true,
        role: true,
        isActive: true,

        managedOutlet: {
          select: {
            id: true,
            isActive: true,
          },
        },
      },
    });

    // Public signup: CUSTOMER only.
    if (intent === "signup") {
      if (existingUser) {
        return sendError(
          res,
          409,
          "An account already exists for this number. Log in instead.",
          "ACCOUNT_EXISTS"
        );
      }

      if (profile.email) {
        const existingEmail = await prisma.user.findUnique({
          where: {
            email: profile.email,
          },
          select: {
            id: true,
          },
        });

        if (existingEmail) {
          return sendError(
            res,
            409,
            "An account already uses this email address.",
            "EMAIL_EXISTS"
          );
        }
      }
    }

    // Existing customer login.
    if (intent === "login") {
      const accountError = validateAccountForIntent(
        existingUser,
        intent
      );

      if (accountError) {
        return sendError(
          res,
          accountError.status,
          accountError.message,
          accountError.code
        );
      }
    }

    // Existing staff login.
    if (intent === "staff") {
      const accountError = validateAccountForIntent(
        existingUser,
        intent
      );

      if (accountError) {
        return sendError(
          res,
          accountError.status,
          accountError.message,
          accountError.code
        );
      }
    }

    const otp = generateOtp();

    const now = new Date();

    const expiresAt = new Date(
      now.getTime() +
      otpConfig.expiryMinutes * 60 * 1000
    );

    const codeHash = hashOtp(
      phone,
      intent,
      otp
    );

    /*
     * OTP_REQUEST_LIMIT applies to all authentication
     * challenges for this phone using LOGIN purpose.
     *
     * Other OTP purposes such as MANAGER_ASSIGNMENT and
     * PHONE_VERIFICATION are not counted.
     *
     * Superseded LOGIN challenges are consumed before
     * inserting the new challenge.
     */

    await prisma.$transaction(
      async (tx) => {
        const windowStart = new Date(
          now.getTime() -
          OTP_REQUEST_WINDOW_MINUTES * 60 * 1000
        );

        const recentRequests = await tx.otpChallenge.count({
          where: {
            phone,
            purpose: OTP_PURPOSE,
            createdAt: {
              gte: windowStart,
            },
          },
        });

        if (recentRequests >= OTP_REQUEST_LIMIT) {
          throw createAuthError(
            "Too many OTP requests. Try again later.",
            429,
            "OTP_RATE_LIMIT"
          );
        }

        const latestChallenge =
          await tx.otpChallenge.findFirst({
            where: {
              phone,
              purpose: OTP_PURPOSE,
              consumedAt: null,
            },

            orderBy: {
              createdAt: "desc",
            },

            select: {
              createdAt: true,
            },
          });

        if (latestChallenge) {
          const secondsSinceRequest =
            (now.getTime() -
              latestChallenge.createdAt.getTime()) /
            1000;

          if (
            secondsSinceRequest <
            otpConfig.resendSeconds
          ) {
            throw createAuthError(
              `Please wait ${Math.ceil(
                otpConfig.resendSeconds -
                secondsSinceRequest
              )} seconds before requesting another OTP.`,
              429,
              "OTP_RESEND_COOLDOWN"
            );
          }
        }

        // Invalidate older outstanding authentication OTPs.
        await tx.otpChallenge.updateMany({
          where: {
            phone,
            purpose: OTP_PURPOSE,
            consumedAt: null,
          },

          data: {
            consumedAt: now,
          },
        });

        await tx.otpChallenge.create({
          data: {
            phone,
            userId: existingUser?.id || null,
            codeHash,
            purpose: OTP_PURPOSE,
            expiresAt,
          },
        });
      },

      {
        isolationLevel: "Serializable",
      }
    );

    const response = {
      success: true,
      message: "OTP generated successfully.",
      expiresInSeconds:
        otpConfig.expiryMinutes * 60,
      resendAfterSeconds:
        otpConfig.resendSeconds,
    };

    // Development-only OTP. Never return it in production.
    if (process.env.NODE_ENV === "development") {
      response.devOtp = otp;
    }

    return res.status(200).json(response);
  } catch (error) {
    return handleControllerError(
      error,
      res,
      next
    );
  }
}

/* =========================================================
   VERIFY OTP
   POST /api/v1/auth/otp/verify
========================================================= */

export async function verifyOtp(req, res, next) {
  try {
    const validation = validateAuthBody(
      req.body,
      "verify"
    );

    if (validation.error) {
      return sendError(
        res,
        400,
        validation.error
      );
    }

    const {
      phone,
      otp,
      intent,
      profile,
    } = validation.value;

    const otpConfig = getOtpConfig();

    const now = new Date();

    // Find the latest valid, unconsumed authentication OTP.
    const challenge =
      await prisma.otpChallenge.findFirst({
        where: {
          phone,
          purpose: OTP_PURPOSE,
          consumedAt: null,

          expiresAt: {
            gt: now,
          },

          attempts: {
            lt: otpConfig.maxAttempts,
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    if (!challenge) {
      const latestChallenge =
        await prisma.otpChallenge.findFirst({
          where: {
            phone,
            purpose: OTP_PURPOSE,
            consumedAt: null,
          },

          orderBy: {
            createdAt: "desc",
          },

          select: {
            attempts: true,
            expiresAt: true,
          },
        });

      if (
        latestChallenge &&
        latestChallenge.attempts >= otpConfig.maxAttempts
      ) {
        return sendError(
          res,
          429,
          "Too many incorrect attempts. Request a new OTP.",
          "OTP_ATTEMPTS_EXCEEDED"
        );
      }

      if (
        latestChallenge &&
        latestChallenge.expiresAt <= now
      ) {
        return sendError(
          res,
          400,
          "This OTP has expired. Request a new code.",
          "OTP_EXPIRED"
        );
      }

      return sendError(
        res,
        400,
        "OTP not found or already used. Request a new code.",
        "OTP_NOT_FOUND"
      );
    }

    // Ensure challenge purpose and account association
    // agree with the requested authentication flow.
    if (
      intent === "signup" &&
      challenge.userId !== null
    ) {
      return sendError(
        res,
        400,
        "Invalid signup OTP challenge.",
        "INVALID_OTP_CHALLENGE"
      );
    }

    if (
      intent !== "signup" &&
      !challenge.userId
    ) {
      return sendError(
        res,
        400,
        "Invalid login OTP challenge.",
        "INVALID_OTP_CHALLENGE"
      );
    }

    const suppliedHash = hashOtp(
      phone,
      intent,
      otp
    );

    if (
      !safeCompare(
        challenge.codeHash,
        suppliedHash
      )
    ) {
      /*
       * Increment attempts atomically.
       *
       * The WHERE condition prevents concurrent requests
       * from incrementing an already exhausted challenge.
       */

      const attemptUpdate =
        await prisma.otpChallenge.updateMany({
          where: {
            id: challenge.id,
            consumedAt: null,

            expiresAt: {
              gt: now,
            },

            attempts: {
              lt: otpConfig.maxAttempts,
            },
          },

          data: {
            attempts: {
              increment: 1,
            },
          },
        });

      if (attemptUpdate.count !== 1) {
        return sendError(
          res,
          429,
          "This OTP is expired, exhausted, or already used.",
          "OTP_NO_LONGER_VALID"
        );
      }

      const updatedChallenge =
        await prisma.otpChallenge.findUnique({
          where: {
            id: challenge.id,
          },

          select: {
            attempts: true,
          },
        });

      const remaining = Math.max(
        0,
        otpConfig.maxAttempts -
        (updatedChallenge?.attempts || otpConfig.maxAttempts)
      );

      return sendError(
        res,
        remaining > 0 ? 400 : 429,

        remaining > 0
          ? `Incorrect OTP. ${remaining} attempts remaining.`
          : "Too many incorrect attempts. Request a new OTP.",

        remaining > 0
          ? "BAD_OTP"
          : "OTP_ATTEMPTS_EXCEEDED"
      );
    }

    /*
     * Transaction guarantees:
     *
     * 1. Challenge is consumed exactly once.
     * 2. Signup cannot create duplicate phone accounts.
     * 3. Email uniqueness is checked again.
     * 4. Role is always selected by the database.
     * 5. Staff assignment is checked inside the transaction.
     * 6. Failed account creation rolls back OTP consumption.
     */

    const userId = await prisma.$transaction(
      async (tx) => {
        const consumed =
          await tx.otpChallenge.updateMany({
            where: {
              id: challenge.id,
              phone,
              purpose: OTP_PURPOSE,
              codeHash: challenge.codeHash,
              userId: challenge.userId,
              consumedAt: null,

              expiresAt: {
                gt: new Date(),
              },

              attempts: {
                lt: otpConfig.maxAttempts,
              },
            },

            data: {
              consumedAt: new Date(),
            },
          });

        if (consumed.count !== 1) {
          throw createAuthError(
            "This OTP has already been used or has expired.",
            400,
            "OTP_ALREADY_USED"
          );
        }

        const account = await tx.user.findUnique({
          where: {
            phone,
          },

          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            role: true,
            isActive: true,

            managedOutlet: {
              select: {
                id: true,
                isActive: true,
              },
            },
          },
        });

        // CUSTOMER SIGNUP
        if (intent === "signup") {
          if (account) {
            throw createAuthError(
              "An account already exists for this number. Log in instead.",
              409,
              "ACCOUNT_EXISTS"
            );
          }

          // Validate email uniqueness again inside transaction.
          if (profile.email) {
            const existingEmail =
              await tx.user.findUnique({
                where: {
                  email: profile.email,
                },

                select: {
                  id: true,
                },
              });

            if (existingEmail) {
              throw createAuthError(
                "An account already uses this email address.",
                409,
                "EMAIL_EXISTS"
              );
            }
          }

          const customer = await tx.user.create({
            data: {
              fullName: profile.name,
              phone,
              email: profile.email,
              pincode: profile.pincode,

              // Never accept role or administrative
              // fields from public signup.
              role: "CUSTOMER",
              isActive: true,
              phoneVerifiedAt: new Date(),
            },

            select: {
              id: true,
            },
          });

          return customer.id;
        }

        // EXISTING CUSTOMER / STAFF LOGIN

        const accountError =
          validateAccountForIntent(
            account,
            intent
          );

        if (accountError) {
          throw createAuthError(
            accountError.message,
            accountError.status,
            accountError.code
          );
        }

        // The challenge must still belong to this exact account.
        if (challenge.userId !== account.id) {
          throw createAuthError(
            "OTP does not belong to the current account.",
            400,
            "OTP_ACCOUNT_MISMATCH"
          );
        }

        // Mark the phone as verified after successful OTP.
        await tx.user.update({
          where: {
            id: account.id,
          },

          data: {
            phoneVerifiedAt: new Date(),
          },

          select: {
            id: true,
          },
        });

        return account.id;
      },

      {
        isolationLevel: "Serializable",
      }
    );

    // Fetch the current session from PostgreSQL.
    // Never construct session permissions from request data.
    const sessionUser = await getSessionUser(userId);

    if (!sessionUser) {
      return sendError(
        res,
        403,
        "Your account or outlet assignment is no longer active.",
        "SESSION_NOT_AVAILABLE"
      );
    }

    // Exactly ONE JWT is issued.
    const token = signAuthToken(userId);

    setAuthCookie(res, token);

    return res
      .status(200)
      .set("Cache-Control", "no-store")
      .json({
        success: true,
        message: "Authentication successful.",
        user: sessionUser,
      });
  } catch (error) {
    return handleControllerError(
      error,
      res,
      next
    );
  }
}

/* =========================================================
   CURRENT SESSION
   GET /api/v1/auth/session
========================================================= */

export async function getCurrentSession(req, res, next) {
  try {
    // Identity must come only from authenticated middleware.
    if (
      !req.user ||
      typeof req.user.id !== "string" ||
      req.user.id.trim() === ""
    ) {
      return sendError(
        res,
        401,
        "Authentication required.",
        "INVALID_SESSION"
      );
    }

    const user = await getSessionUser(
      req.user.id
    );

    if (!user) {
      return sendError(
        res,
        401,
        "Your account is inactive, deleted, or no longer authorised.",
        "SESSION_UNAVAILABLE"
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

/* =========================================================
   LOGOUT
   POST /api/v1/auth/logout
========================================================= */

export async function logout(req, res) {
 clearAuthCookie(res);

  return res.status(200).json({
    success: true,
    message: "Logged out successfully. Remove the current Bearer token from the client.",
  });
}
