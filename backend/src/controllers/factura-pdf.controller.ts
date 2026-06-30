import { Request, Response } from "express";
import {
  regenerarFacturaPDFService,
  obtenerFacturaPDFPathService,
  obtenerTodasLasFacturasService,
} from "../services/factura-pdf.service";
import { getParamAsString } from "../utils/params";
export async function regenerarFacturaPDFController(
  req: Request,
  res: Response
) {
  try {
    const { saleId } = req.params;
    const uploadToCloudinary = req.query.cloudinary === "true";

    const result = await regenerarFacturaPDFService(
      getParamAsString(saleId, "saleId"),
      uploadToCloudinary
    );

    return res.status(200).json({
      ok: true,
      message: "Factura PDF regenerada correctamente",
      content: result,
    });
  } catch (error: any) {
    console.error("❌ Error regenerando factura PDF:", error);
    return res.status(400).json({
      ok: false,
      message: error.message || "No se pudo regenerar la factura PDF",
    });
  }
}

export async function obtenerTodasLasFacturasController(
  req: Request,
  res: Response
) {
  try {
    const facturas = await obtenerTodasLasFacturasService();

    return res.status(200).json({
      ok: true,
      content: facturas,
    });
  } catch (error: any) {
    console.error("❌ Error obteniendo facturas:", error);
    return res.status(500).json({
      ok: false,
      message: error.message || "No se pudieron obtener las facturas",
    });
  }
}
export async function descargarFacturaPDFController(
  req: Request,
  res: Response
) {
  try {
    const { saleId } = req.params;

    const { filePath, fileName } = await obtenerFacturaPDFPathService(getParamAsString(saleId, "saleId"));

    return res.download(filePath, fileName, (err) => {
      if (err) {
        console.error("❌ Error al descargar PDF:", err);

        if (!res.headersSent) {
          res.status(500).json({
            ok: false,
            message: "Error al descargar el PDF",
          });
        }
      }
    });
  } catch (error: any) {
    console.error("❌ Error obteniendo factura PDF:", error);
    return res.status(400).json({
      ok: false,
      message: error.message || "No se pudo descargar la factura PDF",
    });
  }
}