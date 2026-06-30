import { Router } from "express";
import { businessLocationController } from "../controllers/businessLocation.controller";
import { authMiddleware, requireRole } from "../middleware/auth";

const router = Router();

router.post(
  "/",
  authMiddleware,
  requireRole("ADMIN"),
  businessLocationController.create
);

router.get("/", authMiddleware, businessLocationController.getAll);

router.get("/:id", authMiddleware, businessLocationController.getOne);

router.put(
  "/:id",
  authMiddleware,
  requireRole("ADMIN"),
  businessLocationController.update
);

router.patch(
  "/:id/default",
  authMiddleware,
  requireRole("ADMIN"),
  businessLocationController.setDefault
);

router.delete(
  "/:id",
  authMiddleware,
  requireRole("ADMIN"),
  businessLocationController.remove
);

export default router;