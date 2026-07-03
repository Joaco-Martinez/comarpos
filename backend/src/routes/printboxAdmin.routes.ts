import { Router } from "express";
import { printboxController } from "../controllers/printbox.controller";
import { authMiddleware, requireRole } from "../middleware/auth";

// Rutas de administración del Printbox del negocio (panel web). Requieren
// sesión de usuario ADMIN dentro del tenant resuelto por subdominio.
const router = Router();

router.use(authMiddleware, requireRole("ADMIN"));

router.get("/", printboxController.status);
router.post("/register", printboxController.register);
router.post("/rotate-token", printboxController.rotateToken);
router.post("/active", printboxController.setActive);

export default router;
