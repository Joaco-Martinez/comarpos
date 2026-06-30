import { Router } from "express";
import { financeController } from "../controllers/finance.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// CRUD básico
router.get("/", authMiddleware, financeController.getAll);
router.post("/", authMiddleware, financeController.create);

// Estadísticas simples
router.get("/income/month", authMiddleware, financeController.getIncomeByMonth);
router.get("/income/year", authMiddleware, financeController.getIncomeByYear);
router.get("/income/week", authMiddleware, financeController.getIncomeByWeek);

router.post(
  "/register-credit-note",
  authMiddleware,
  financeController.registerCreditNote,
);

// Estadísticas extendidas
router.get(
  "/income/category",
  authMiddleware,
  financeController.getIncomeByCategory,
);

router.get(
  "/sales/by-stock-location",
  authMiddleware,
  financeController.getSalesByStockLocation,
);

router.get("/products/top", authMiddleware, financeController.getTopProducts);
router.get(
  "/products/worst",
  authMiddleware,
  financeController.getWorstProducts,
);

router.get(
  "/products/top-range",
  authMiddleware,
  financeController.getTopProductsInRange,
);

router.get(
  "/products/worst-range",
  authMiddleware,
  financeController.getWorstProductsInRange,
);

// Mejor producto de un mes específico
router.get("/products/best-month", financeController.getBestProductMonth);

// Peor producto de un mes específico
router.get("/products/worst-month", financeController.getWorstProductMonth);

// Exportaciones
router.get("/export/excel", authMiddleware, financeController.exportExcel);
router.get("/export/pdf", authMiddleware, financeController.exportPDF);

// Editar / eliminar
router.put("/:id", authMiddleware, financeController.update);
router.patch("/:id", authMiddleware, financeController.update);
router.delete("/:id", authMiddleware, financeController.remove);

export default router;