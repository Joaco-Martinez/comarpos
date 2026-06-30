import { Router } from "express";
import { categoryController } from "../controllers/category.controller";
import { authMiddleware, requireRole } from "../middleware/auth";

const router = Router();

router.get("/", authMiddleware, categoryController.getAll);
router.get("/slug/:slug", authMiddleware, categoryController.getBySlug);
router.get("/:id", authMiddleware, categoryController.getById);

router.post(
  "/",
  authMiddleware,
  requireRole("ADMIN"),
  categoryController.create
);

router.put(
  "/:id",
  authMiddleware,
  requireRole("ADMIN"),
  categoryController.update
);

router.delete(
  "/:id",
  authMiddleware,
  requireRole("ADMIN"),
  categoryController.delete
);

router.patch(
  "/:id/restore",
  authMiddleware,
  requireRole("ADMIN"),
  categoryController.restore
);

export default router;