import { Router } from "express";
import { accountController } from "../controllers/account.controller";
import { authMiddleware, requireRole } from "../middleware/auth";

const router = Router();

router.get("/movements", authMiddleware, accountController.getMovements);
router.get("/debtors", authMiddleware, accountController.getDebtors);

router.get(
  "/clients/:clientId",
  authMiddleware,
  accountController.getClientAccount
);

router.post(
  "/clients/:clientId/payment",
  authMiddleware,
  accountController.registerPayment
);

router.post(
  "/clients/:clientId/adjustment",
  authMiddleware,
  requireRole("ADMIN"),
  accountController.createAdjustment
);

router.patch(
  "/clients/:clientId/config",
  authMiddleware,
  requireRole("ADMIN"),
  accountController.updateClientAccountConfig
);

export default router;