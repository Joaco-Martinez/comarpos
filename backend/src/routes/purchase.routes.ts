import { Router } from "express";
import { purchaseController } from "../controllers/purchase.controller";
import { authMiddleware, requireRole } from "../middleware/auth";

const router = Router();

router.get("/", authMiddleware, purchaseController.getAll);
router.get("/:id", authMiddleware, purchaseController.getById);

router.post(
  "/",
  authMiddleware,
  requireRole("ADMIN"),
  purchaseController.create
);

router.patch(
  "/:id/supplier",
  authMiddleware,
  requireRole("ADMIN"),
  purchaseController.updateSupplier
);

router.patch(
  "/:id/cancel",
  authMiddleware,
  requireRole("ADMIN"),
  purchaseController.cancel
);

export default router;
