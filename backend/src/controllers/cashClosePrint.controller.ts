import { Request, Response } from "express";
import { printCashClose } from "../services/cashClosePrint.service";

export async function printCashCloseController(req: Request, res: Response) {
  console.log("Iniciando impresión de cierre de caja...");
  
    try {
    const result = await printCashClose(req.body);
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
