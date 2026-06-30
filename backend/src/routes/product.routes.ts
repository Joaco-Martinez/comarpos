import { Router } from "express";
import { productController } from "../controllers/product.controller";
import { authMiddleware, requireRole } from "../middleware/auth";

const router = Router();

// Movimientos de stock
// overview: devuelve 5 ingresos, 5 salidas y 5 transferencias por defecto.
router.get("/movements/overview", authMiddleware, productController.getMovementsOverview);

// search: búsqueda/paginación por tipo visual, producto, SKU, fecha, usuario, referencia.
router.get("/movements/search", authMiddleware, productController.searchMovements);

// Compatibilidad con el endpoint viejo.
router.get("/movements", authMiddleware, productController.getMovements);

// Stock UNIT
router.post("/transfer", authMiddleware, productController.transferStock);
router.post("/add-stock", authMiddleware, productController.addStock);

// Stock KG
router.post(
  "/:id/transfer-kg",
  authMiddleware,
  requireRole("ADMIN"),
  productController.transferStockKg
);

router.post(
  "/:id/add-stock-kg",
  authMiddleware,
  requireRole("ADMIN"),
  productController.addStockKg
);

// SKU
router.get("/sku/:sku", authMiddleware, productController.getBySku);

// CRUD
router.get("/", authMiddleware, productController.getAll);

router.post(
  "/",
  authMiddleware,
  requireRole("ADMIN"),
  productController.create
);

// Producto compuesto: definir/actualizar componentes de una promo
router.put(
  "/:id/components",
  authMiddleware,
  requireRole("ADMIN"),
  productController.updateComponents
);

// Actualizar imagen
router.patch(
  "/:id/image",
  authMiddleware,
  requireRole("ADMIN"),
  productController.updateImage
);

// Dinámicas
router.get("/:id", authMiddleware, productController.getById);

router.put(
  "/:id",
  authMiddleware,
  requireRole("ADMIN"),
  productController.update
);

router.delete(
  "/:id",
  authMiddleware,
  requireRole("ADMIN"),
  productController.delete
);

export default router;
