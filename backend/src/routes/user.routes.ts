import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { authMiddleware, requireRole } from "../middleware/auth";

const router = Router();

router.put("/me/preferences", authMiddleware, userController.updateOwnPreferences);
router.get("/", authMiddleware, requireRole("ADMIN"), userController.getAll);
router.get("/:id/activity", authMiddleware, requireRole("ADMIN"), userController.getActivityById);
router.get("/:id", authMiddleware, requireRole("ADMIN"), userController.getById);
router.post("/", authMiddleware, requireRole("ADMIN"), userController.create);
router.put("/:id", authMiddleware, requireRole("ADMIN"), userController.update);
router.delete("/:id", authMiddleware, requireRole("ADMIN"), userController.delete);

export default router;