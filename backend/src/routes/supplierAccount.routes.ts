import { Router } from "express";
import { supplierAccountController } from "../controllers/supplierAccount.controller";
import { authMiddleware, requireRole } from "../middleware/auth";

const router = Router();

router.get("/:supplierId", authMiddleware, supplierAccountController.getBalance);
router.get("/:supplierId/movements", authMiddleware, supplierAccountController.getMovements);

router.post(
  "/:supplierId/payment",
  authMiddleware,
  requireRole("ADMIN"),
  supplierAccountController.registerPayment
);

router.post(
  "/:supplierId/adjustment",
  authMiddleware,
  requireRole("ADMIN"),
  supplierAccountController.createAdjustment
);

export default router;
