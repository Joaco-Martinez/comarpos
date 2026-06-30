import { Router } from "express";
import { getAlerts, checkAllStockAlerts } from "../controllers/alert.controller";

const router = Router();

router.get("/", getAlerts);
router.post("/check-stock", checkAllStockAlerts);

export default router;