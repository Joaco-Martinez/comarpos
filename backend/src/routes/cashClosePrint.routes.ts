import { Router } from "express";
import { printCashCloseController } from "../controllers/cashClosePrint.controller";

const router = Router();

// POST /cash-close/print
router.post("/print", printCashCloseController);

export default router;
