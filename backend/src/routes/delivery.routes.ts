import { Router } from "express";
import { deliveryController } from "../controllers/delivery.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.post("/calculate", authMiddleware, deliveryController.calculate);

export default router;
