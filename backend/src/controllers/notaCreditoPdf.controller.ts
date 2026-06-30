import { Request, Response, NextFunction } from "express";
import fs from "fs";
import { obtenerNotaCreditoPDFPathService } from "../services/notaCreditoPdf.service";

export const notaCreditoPdfController = {
  async descargar(req: Request, res: Response, next: NextFunction) {
    try {
      const { saleId } = req.params;

      if (!saleId) {
        return res.status(400).json({
          ok: false,
          error: "saleId es requerido",
        });
      }
      if (Array.isArray(saleId)) {
        return res.status(400).json({
          ok: false,
          error: "saleId no puede ser un arreglo",
        });
      }

      const { filePath, fileName } = await obtenerNotaCreditoPDFPathService(saleId);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

      const stream = fs.createReadStream(filePath);

      stream.pipe(res);

      stream.on("close", () => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    } catch (err) {
      next(err);
    }
  },
};