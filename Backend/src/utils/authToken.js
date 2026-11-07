
import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

const JWT_ISSUER = "dastarkhwan-api";
const JWT_AUDIENCE = "dastarkhwan-client";

function getSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 12) {
    throw new Error(
      "JWT_SECRET must be configured and contain at least 12 characters.",
    );
  }

  return secret;
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function createSignature(input) {
  return createHmac("sha256", getSecret())
    .update(input)
    .digest("base64url");
}

function getExpirySeconds() {
  const value = process.env.JWT_EXPIRES_IN || "7d";

  const match = value.match(/^(\d+)([smhd])$/);

  if (!match) {
    throw new Error(
      "JWT_EXPIRES_IN must use a format such as 30m, 12h, or 7d.",
    );
  }

  const amount = Number(match[1]);

  const multipliers = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return amount * multipliers[match[2]];
}

export function signAuthToken(userId) {
  if (!userId) {
    throw new Error("A user ID is required to generate an access token.");
  }

  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload = {
    sub: userId,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: now,
    exp: now + getExpirySeconds(),
  };

  const encodedHeader = base64UrlEncode(
    JSON.stringify(header),
  );

  const encodedPayload = base64UrlEncode(
    JSON.stringify(payload),
  );

  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  return `${unsignedToken}.${createSignature(unsignedToken)}`;
}

export function verifyAuthToken(token) {
  if (typeof token !== "string") {
    throw new Error("Invalid token.");
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid token format.");
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = createSignature(unsignedToken);

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid token signature.");
  }

  let header;
  let payload;

  try {
    header = JSON.parse(
      Buffer.from(encodedHeader, "base64url").toString("utf8"),
    );

    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
  } catch {
    throw new Error("Invalid token payload.");
  }

  const now = Math.floor(Date.now() / 1000);

  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw new Error("Unsupported token algorithm.");
  }

  if (payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE) {
    throw new Error("Invalid token issuer or audience.");
  }

  if (!payload.sub || !Number.isFinite(payload.exp)) {
    throw new Error("Invalid token claims.");
  }

  if (payload.exp <= now) {
    throw new Error("Token has expired.");
  }

  return payload;
}
