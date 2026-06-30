import { Router } from "express";
import { supplierController } from "../controllers/supplier.controller";
import { authMiddleware, requireAnyRole, requireRole } from "../middleware/auth";

const router = Router();

router.get("/", authMiddleware, requireAnyRole(["ADMIN", "EMPLEADO"]), supplierController.getAll);
router.get("/:id", authMiddleware, requireAnyRole(["ADMIN", "EMPLEADO"]), supplierController.getOne);
router.post("/", authMiddleware, requireAnyRole(["ADMIN", "EMPLEADO"]), supplierController.create);
router.put("/:id", authMiddleware, requireAnyRole(["ADMIN", "EMPLEADO"]), supplierController.update);
router.delete("/:id", authMiddleware, requireRole("ADMIN"), supplierController.remove);

export default router;
