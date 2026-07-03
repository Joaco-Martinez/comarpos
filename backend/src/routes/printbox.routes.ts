import { Router } from "express";
import { printboxController } from "../controllers/printbox.controller";
import { printboxAuthMiddleware } from "../middleware/printboxAuth";

// Rutas que llama el dispositivo (ESP32 + W5500) directamente. Se
// autentican con el Bearer token del Printbox, no con subdominio/JWT de
// usuario: por eso están excluidas de tenantMiddleware (ver src/app.ts y
// src/middleware/tenant.ts).
const router = Router();

router.get("/poll", printboxAuthMiddleware, printboxController.poll);
router.post("/ack/:id", printboxAuthMiddleware, printboxController.ack);

export default router;
