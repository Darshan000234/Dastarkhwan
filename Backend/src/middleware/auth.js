import { notImplemented } from "../utils/routePlaceholder.js";

/** Placeholder for later JWT/session authentication implementation. */
export const authenticate = notImplemented;

/** Role middleware factory; authorization logic will be added with auth controllers. */
export const authorize =
  (...roles) =>
  (req, res, next) => {
    // Route contract only. Replace with verified JWT role checks in the auth task.
    if (!req.user)
      return res
        .status(501)
        .json({
          success: false,
          message: "Authentication middleware is not implemented yet.",
        });
    if (roles.length && !roles.includes(req.user.role))
      return res.status(403).json({ success: false, message: "Forbidden." });
    return next();
  };

/** Outlet ownership enforcement placeholder for manager-scoped APIs. */
export const requireAssignedOutlet = (req, res, next) => {
  if (!req.user)
    return res
      .status(501)
      .json({
        success: false,
        message: "Authentication middleware is not implemented yet.",
      });
  if (req.user.role !== "outlet_manager")
    return res
      .status(403)
      .json({ success: false, message: "Outlet manager access required." });
  if (!req.user.outletId)
    return res
      .status(403)
      .json({
        success: false,
        message: "No outlet is assigned to this manager.",
      });
  req.managerOutletId = req.user.outletId;
  return next();
};
