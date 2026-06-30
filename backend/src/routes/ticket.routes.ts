import { Router } from "express";
import { ticketController } from "../controllers/ticket.controller";

const router = Router();

router.post("/sale/:saleId/print", ticketController.printSaleTicket);

export default router;