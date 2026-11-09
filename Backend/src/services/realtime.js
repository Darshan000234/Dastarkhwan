
import { Server } from "socket.io";
import prisma from "../db/prisma.js";
import { env } from "../config/env.js";
import {
  AUTH_COOKIE_NAME,
  verifyAuthToken,
} from "../utils/authToken.js";

let ioInstance = null;

const ROLE_MAP = {
  CUSTOMER: "customer",
  CENTRAL_ADMIN: "central_admin",
  OUTLET_MANAGER: "outlet_manager",
};

function parseCookies(header = "") {
  const cookies = {};

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");

    if (separator === -1) continue;

    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (!name) continue;

    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }

  return cookies;
}


async function authenticateSocket(socket, next) {
  try {
    const cookieHeader =
      socket.handshake.headers.cookie || "";

    const cookies = parseCookies(cookieHeader);

    const token = cookies[AUTH_COOKIE_NAME];

    console.info("[Socket.IO] Authentication handshake", {
      origin: socket.handshake.headers.origin,
      host: socket.handshake.headers.host,
      expectedCookieName: AUTH_COOKIE_NAME,
      receivedCookieNames: Object.keys(cookies),
      authenticationCookiePresent: Boolean(token),
      transport: socket.conn.transport.name,
    });

    if (!token) {
      console.error(
        "[Socket.IO] Rejected: authentication cookie missing."
      );

      return next(new Error("Authentication required."));
    }

    let claims;

    try {
      claims = verifyAuthToken(token);
    } catch {
      return next(new Error("Invalid or expired session."));
    }

    const user = await prisma.user.findUnique({
      where: {
        id: claims.sub,
      },
      select: {
        id: true,
        fullName: true,
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

    if (!user || !user.isActive) {
      return next(new Error("Account unavailable."));
    }

    const role = ROLE_MAP[user.role];

    if (!role) {
      return next(new Error("Unsupported account role."));
    }

    if (
      role === "outlet_manager" &&
      (!user.managedOutlet || !user.managedOutlet.isActive)
    ) {
      return next(new Error("No active outlet assignment."));
    }

    socket.data.user = {
      id: user.id,
      name: user.fullName,
      role,
      outletId:
        role === "outlet_manager"
          ? user.managedOutlet.id
          : null,
    };

    return next();
  } catch (error) {
    console.error("Socket authentication error:", error.message);
    return next(new Error("Socket authentication failed."));
  }
}

export function initializeRealtime(httpServer) {
  if (ioInstance) {
    throw new Error("Socket.IO has already been initialized.");
  }

  const allowedOrigins = env.clientOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  ioInstance = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        // Non-browser clients may omit Origin.
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error("Socket origin not allowed."));
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
    maxHttpBufferSize: 1e6,
  });

  ioInstance.use(authenticateSocket);

  ioInstance.on("connection", async (socket) => {
    const user = socket.data.user;

    try {
      if (user.role === "customer") {
        await socket.join(`customer:${user.id}`);
      } else if (user.role === "outlet_manager") {
        await socket.join(`outlet:${user.outletId}`);
      } else if (user.role === "central_admin") {
        await socket.join("central-admin");
      }

      console.info(
        `Socket connected: role=${user.role} user=${user.id}`,
      );
    } catch (error) {
      console.error("Socket room assignment failed:", error.message);
      socket.disconnect(true);
      return;
    }

    socket.on("disconnect", (reason) => {
      console.info(
        `Socket disconnected: user=${user.id} reason=${reason}`,
      );
    });
  });

  return ioInstance;
}

export function getRealtime() {
  return ioInstance;
}

function emitToRoom(room, event, payload) {
  if (!ioInstance) {
    return false;
  }

  ioInstance.to(room).emit(event, payload);
  return true;
}

export function emitOrderCreated({
  outletId,
  orderId,
  orderNumber,
  status,
  placedAt,
  promisedAt,
  estimatedPrepMinutes,
}) {
  if (!outletId || !orderId || !orderNumber) {
    return false;
  }

  return emitToRoom(`outlet:${outletId}`, "order:created", {
    orderId,
    orderNumber,
    status,
    placedAt,
    promisedAt,
    estimatedPrepMinutes,
  });
}

export function emitOrderStatusUpdated({
  outletId,
  customerId,
  orderId,
  orderNumber,
  status,
  updatedAt,
}) {
  if (!outletId || !customerId || !orderId) {
    return false;
  }

  const payload = {
    orderId,
    orderNumber,
    status,
    updatedAt,
  };

  emitToRoom(
    `outlet:${outletId}`,
    "order:status-updated",
    payload,
  );

  emitToRoom(
    `customer:${customerId}`,
    "order:status-updated",
    payload,
  );

  return true;
}

export function emitOrderEtaUpdated({
  outletId,
  customerId,
  orderId,
  orderNumber,
  estimatedPrepMinutes,
  promisedAt,
  updatedAt,
}) {
  if (
    !outletId ||
    !customerId ||
    !orderId ||
    !promisedAt
  ) {
    return false;
  }

  const payload = {
    orderId,
    orderNumber,
    estimatedPrepMinutes,
    promisedAt,
    updatedAt,
  };

  emitToRoom(
    `outlet:${outletId}`,
    "order:eta-updated",
    payload,
  );

  emitToRoom(
    `customer:${customerId}`,
    "order:eta-updated",
    payload,
  );

  return true;
}

export function emitMenuAvailabilityUpdated({
  outletId,
  foodItemId,
  isAvailable,
  stockQuantity,
  updatedAt,
}) {
  if (!outletId || !foodItemId) {
    return false;
  }

  return emitToRoom(
    `outlet:${outletId}`,
    "menu:availability-updated",
    {
      foodItemId,
      isAvailable,
      stockQuantity,
      updatedAt,
    },
  );
}

export function closeRealtime() {
  if (!ioInstance) return Promise.resolve();

  const current = ioInstance;
  ioInstance = null;

  return new Promise((resolve) => {
    current.close(() => resolve());
  });
}
