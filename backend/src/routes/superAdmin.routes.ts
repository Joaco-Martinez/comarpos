import { Router } from "express";
import { superAdminController } from "../controllers/superAdmin.controller";

// Montado en app.ts como: app.use("/super-admin", authMiddleware, requireRole("SUPER_ADMIN"), superAdminRoutes);
// authMiddleware + requireRole("SUPER_ADMIN") ya se aplican en el punto de montaje, no hace falta repetirlos aquí.
const router = Router();

router.get("/businesses", superAdminController.listBusinesses);
router.get("/businesses/:id", superAdminController.getBusiness);
router.post("/businesses", superAdminController.createBusiness);
router.patch("/businesses/:id", superAdminController.updateBusiness);
router.patch("/businesses/:id/status", superAdminController.setBusinessStatus);
router.post("/businesses/:id/suspend", superAdminController.suspendBusiness);
router.post("/businesses/:id/activate", superAdminController.activateBusiness);
router.post("/businesses/:id/mark-payment", superAdminController.markPaymentReceived);

router.get("/super-admins", superAdminController.listSuperAdmins);
router.post("/super-admins", superAdminController.createSuperAdmin);
router.patch("/super-admins/:id/deactivate", superAdminController.deactivateSuperAdmin);

export default router;
