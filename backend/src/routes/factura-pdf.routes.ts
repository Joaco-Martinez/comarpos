import { Router } from "express";
import {
  regenerarFacturaPDFController,
  descargarFacturaPDFController,
  obtenerTodasLasFacturasController,
} from "../controllers/factura-pdf.controller";

const router = Router();

router.get("/all", obtenerTodasLasFacturasController);
router.post("/:saleId/regenerar", regenerarFacturaPDFController);
router.get("/:saleId/descargar", descargarFacturaPDFController);

export default router;