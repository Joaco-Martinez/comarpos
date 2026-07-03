import { Request, Response } from "express";
import { printCashClose } from "../services/cashClosePrint.service";

export async function printCashCloseController(req: Request, res: Response) {
  console.log("Iniciando impresión de cierre de caja...");
  
    try {
    if (!req.business) {
      return res.status(404).json({ message: "Negocio no encontrado" });
    }

    const result = await printCashClose(req.body, req.business.id);
    console.log("PRINT BODY:", req.body);
    return res.status(200).json({
      message: "Cierre enviado a impresión",
      ...result,
    });
  } catch (err: any) {
    console.error("❌ Error print cash close:", err?.message || err);
    return res.status(400).json({
      message: err?.message || "Error al imprimir cierre de caja",
    });
  }
}
