import { Request, Response } from "express";
import { ticketService } from "../services/ticket.service";

export const ticketController = {
  async printSaleTicket(req: Request, res: Response) {
    try {
      const { saleId } = req.params;

      if (!saleId || Array.isArray(saleId)) {
        return res.status(400).json({
          ok: false,
          error: "saleId es requerido",
        });
      }

      const result = await ticketService.printSaleTicket(saleId);

      return res.status(200).json({
        ok: true,
        message: "Ticket no fiscal enviado a impresión.",
        data: result,
      });
    } catch (err: any) {
      console.error("❌ Error imprimiendo ticket no fiscal:", err);

      return res.status(500).json({
        ok: false,
        error: err.message || "No se pudo imprimir el ticket.",
      });
    }
  },
};