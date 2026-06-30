import { Router } from "express";
import { remitoController } from "../controllers/remito.controller";
import { authMiddleware } from "../middleware/auth";


const router = Router();

router.use(authMiddleware);

router.post("/from-sale/:saleId", remitoController.createFromSale);

router.get("/", remitoController.getAll);
router.get("/:id/pdf", remitoController.downloadPdf);
router.get("/:id", remitoController.getById);

router.post("/:id/regenerate-pdf", remitoController.regeneratePdf);
router.patch("/:id/delivered", remitoController.markAsDelivered);
router.patch("/:id/cancel", remitoController.cancel);

export default router;