
import prisma from "../db/prisma.js";
import {
  AUTH_COOKIE_NAME,
  verifyAuthToken,
} from "../utils/authToken.js";
const ROLE_MAP = {
  CUSTOMER: "customer",
  CENTRAL_ADMIN: "central_admin",
  OUTLET_MANAGER: "outlet_manager",
};

export async function authenticate(req, res, next) {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please sign in.",
      });
    }

    let claims;

    try {
      claims = verifyAuthToken(token);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Your session is invalid or expired. Please sign in again.",
      });
    }

    // Always retrieve current account information from PostgreSQL.
    // Never trust a role or outlet ID supplied in the JWT or request body.
    const user = await prisma.user.findUnique({
      where: {
        id: claims.sub,
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

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "This account is unavailable. Please contact support.",
      });
    }

    const role = ROLE_MAP[user.role];

    if (!role) {
      return res.status(403).json({
        success: false,
        message: "Your account has an unsupported role.",
      });
    }

    if (
      role === "outlet_manager" &&
      (!user.managedOutlet || !user.managedOutlet.isActive)
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have an active outlet assignment.",
      });
    }

    // The JWT only identifies the user. Current permissions come from DB.
    req.user = {
      id: user.id,
      name: user.fullName,
      phone: user.phone,
      email: user.email,
      role,
      outletId:
        role === "outlet_manager"
          ? user.managedOutlet.id
          : null,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorised to access this resource.",
      });
    }

    return next();
  };
}

export function requireAssignedOutlet(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }
  
  if (req.user.role !== "outlet_manager") {
    return res.status(403).json({
      success: false,
      message: "Outlet Manager access required.",
    });
  }

  if (!req.user.outletId) {
    return res.status(403).json({
      success: false,
      message: "No active outlet is assigned to this account.",
    });
  }

  // Downstream manager controllers must use this value,
  // not an outlet ID supplied by the frontend.
  req.managerOutletId = req.user.outletId;

  return next();
}
