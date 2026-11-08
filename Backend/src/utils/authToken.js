
import jwt from "jsonwebtoken";

/* =========================================
   JWT CONFIGURATION
========================================= */

const JWT_ISSUER = "dastarkhwan-api";
const JWT_AUDIENCE = "dastarkhwan-client";

export const AUTH_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME || "dastarkhwan_auth";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (
    typeof secret !== "string" ||
    Buffer.byteLength(secret, "utf8") < 12
  ) {
    throw new Error(
      "JWT_SECRET must contain at least 12 bytes."
    );
  }

  return secret;
}

function getJwtExpiresIn() {
  const value = process.env.JWT_EXPIRES_IN || "7d";

  // Only permit explicit units.
  if (!/^[1-9]\d*(s|m|h|d)$/.test(value)) {
    throw new Error(
      "JWT_EXPIRES_IN must use a format such as 30m, 12h, or 7d."
    );
  }

  return value;
}

function getJwtLifetimeMs() {
  const value = getJwtExpiresIn();
  const match = /^([1-9]\d*)(s|m|h|d)$/.exec(value);

  const amount = Number(match[1]);

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const lifetime = amount * multipliers[match[2]];

  if (!Number.isSafeInteger(lifetime)) {
    throw new Error("JWT expiration is too large.");
  }

  return lifetime;
}

/* =========================================
   SIGN JWT
========================================= */

export function signAuthToken(userId) {
  if (
    typeof userId !== "string" ||
    !userId.trim()
  ) {
    throw new Error("A valid user ID is required.");
  }

  return jwt.sign(
    {},
    getJwtSecret(),
    {
      algorithm: "HS256",
      subject: userId,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: getJwtExpiresIn(),
    }
  );
}

/* =========================================
   VERIFY JWT
========================================= */

export function verifyAuthToken(token) {
  if (
    typeof token !== "string" ||
    !token.trim()
  ) {
    throw new Error("Authentication token is missing.");
  }

  const payload = jwt.verify(
    token,
    getJwtSecret(),
    {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.sub !== "string" ||
    !payload.sub.trim()
  ) {
    throw new Error("Invalid authentication token payload.");
  }

  return payload;
}

/* =========================================
   COOKIE CONFIGURATION
========================================= */

export function getAuthCookieOptions() {
  const configuredSameSite = String(
    process.env.AUTH_COOKIE_SAME_SITE || "lax"
  ).toLowerCase();

  if (
    !["lax", "strict", "none"].includes(
      configuredSameSite
    )
  ) {
    throw new Error(
      "AUTH_COOKIE_SAME_SITE must be lax, strict, or none."
    );
  }

  const secure =
    process.env.NODE_ENV === "production" ||
    configuredSameSite === "none";

  const options = {
    httpOnly: true,
    secure,
    sameSite: configuredSameSite,
    path: process.env.AUTH_COOKIE_PATH || "/api/v1",
    maxAge: getJwtLifetimeMs(),
  };

  // Only configure a domain when explicitly required.
  // Do not set this for localhost.
  if (process.env.AUTH_COOKIE_DOMAIN) {
    options.domain = process.env.AUTH_COOKIE_DOMAIN;
  }

  return options;
}

/* =========================================
   SET AUTH COOKIE
========================================= */

export function setAuthCookie(res, token) {
  if (typeof token !== "string" || !token) {
    throw new Error("Cannot set an empty authentication token.");
  }

  res.cookie(
    AUTH_COOKIE_NAME,
    token,
    getAuthCookieOptions()
  );
}

/* =========================================
   CLEAR AUTH COOKIE
========================================= */

export function clearAuthCookie(res) {
  const {
    httpOnly,
    secure,
    sameSite,
    path,
    domain,
  } = getAuthCookieOptions();

  const options = {
    httpOnly,
    secure,
    sameSite,
    path,
  };

  if (domain) {
    options.domain = domain;
  }

  res.clearCookie(AUTH_COOKIE_NAME, options);
}
