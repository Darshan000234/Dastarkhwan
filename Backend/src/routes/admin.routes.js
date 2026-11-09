import { Router } from "express";
import * as admin from "../controllers/admin.controller.js";
import * as outlets from "../controllers/outlet.controller.js";
import * as orders from "../controllers/order.controller.js";
import * as menu from "../controllers/menu.controller.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();
router.use(authenticate, authorize("central_admin"));
router.get("/overview", admin.getOverview);
router.get("/audit-log", admin.getAuditLog);
router.get("/settings", admin.getSettings);
router.patch("/settings", admin.updateSettings);
router.post("/demo/reset", admin.resetDemoData);

router.get("/orders", orders.listOrders);
router.get("/orders/:orderId", orders.getOrder);
router.get("/outlets", outlets.listOutlets);
router.post("/outlets", outlets.createOutlet);
router.get("/outlets/:outletId", outlets.getOutlet);
router.patch("/outlets/:outletId", outlets.updateOutlet);
router.patch("/outlets/:outletId/status", outlets.updateOutletStatus);
router.get("/outlets/:outletId/analytics", outlets.getOutletAnalytics);
router.get("/outlets/:outletId/orders", outlets.getOutletOrders);
router.get("/outlets/:outletId/menu", outlets.getOutletMenu);
router.post("/outlets/:outletId/manager/otp", outlets.sendManagerOtp);
router.post( "/outlets/:outletId/manager/verify-and-assign", outlets.verifyManagerOtp);
router.get("/menu/catalog", menu.listCatalog);
router.get("/menu/catalog/:itemId", menu.getCatalogItem);
router.post("/menu/catalog", menu.createCatalogItem);
router.patch("/menu/catalog/:itemId", menu.updateCatalogItem);
router.delete("/menu/catalog/:itemId", menu.archiveCatalogItem);
router.patch("/menu/catalog/:itemId/city-prices/:city", menu.updateCityPrice);
router.post("/menu/catalog/:itemId/outlets", menu.assignItemToOutlet);
router.patch(
  "/menu/catalog/:itemId/outlets/:outletId",
  menu.updateOutletMapping,
);
router.delete(
  "/menu/catalog/:itemId/outlets/:outletId",
  menu.removeOutletMapping,
);
router.get("/menu/time-menus", menu.listTimeMenus);
router.post("/menu/time-menus", menu.createTimeMenu);
router.patch("/menu/time-menus/:timeMenuId", menu.updateTimeMenu);
router.delete("/menu/time-menus/:timeMenuId", menu.deleteTimeMenu);

export default router;
