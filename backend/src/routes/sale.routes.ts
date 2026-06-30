import { Router } from "express";
import { saleController } from "../controllers/sale.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.get("/", authMiddleware, saleController.getAll);
router.get("/pending", authMiddleware, saleController.getPending);

router.post("/pending/bulk-update", authMiddleware, saleController.bulkUpdate);

router.post("/", authMiddleware, saleController.create);

router.patch("/:id/items", authMiddleware, saleController.updateItems);

router.patch("/:id/status", authMiddleware, saleController.updateStatus);

router.patch("/:id/payment", authMiddleware, saleController.updatePaymentMethod);

router.patch("/:id/payments", authMiddleware, saleController.updatePayments);

router.post("/:id/nota-pedido", authMiddleware, saleController.generarNotaPedido);

router.get(
  "/:id/cotizacion-pdf",
  authMiddleware,
  saleController.generarCotizacion
);

router.get(
  "/:id/comprobante-pdf",
  authMiddleware,
  saleController.generarComprobante
);

router.get("/:id", authMiddleware, saleController.getById);

export default router;
