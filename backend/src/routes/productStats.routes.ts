import { Router } from "express";
import { productStatsController } from "../controllers/productStast.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.get("/top", authMiddleware, productStatsController.getTop);
router.get("/worst", authMiddleware, productStatsController.getWorst);

router.get("/top-range", authMiddleware, productStatsController.getTopRange);
router.get("/worst-range", authMiddleware, productStatsController.getWorstRange);

router.get("/best-month", authMiddleware, productStatsController.getBestMonth);
router.get("/worst-month", authMiddleware, productStatsController.getWorstMonth);

router.get("/totals", authMiddleware, productStatsController.getTotals);
router.get("/totals-range", authMiddleware, productStatsController.getTotalsRange);

export default router;