import { Router } from "express";
import { notaCreditoPdfController } from "../controllers/notaCreditoPdf.controller";

const router = Router();

router.get("/:saleId/descargar", notaCreditoPdfController.descargar);

export default router;