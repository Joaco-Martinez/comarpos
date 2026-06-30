import { Router } from "express";
import { catalogController } from "../controllers/catalog.controller";
import {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
} from "../middleware/auth";

const router = Router();

router.get("/categories", catalogController.getCategories);

router.get(
  "/products",
  optionalAuthMiddleware,
  catalogController.getProducts
);

router.post(
  "/validate-cart",
  authMiddleware,
  requireRole("CLIENTE"),
  catalogController.validateCart
);

router.post(
  "/checkout-whatsapp",
  authMiddleware,
  requireRole("CLIENTE"),
  catalogController.checkoutWhatsapp
);

export default router;