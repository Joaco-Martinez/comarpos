import { Request, Response } from "express";
import { RemitoStatus } from "@prisma/client";
import { remitoService } from "../services/remito.service";
import { getParamAsString } from "../utils/params";

function getAuthUserId(req: Request): string | undefined {
  const anyReq = req as any;
  return anyReq.user?.id || anyReq.userId || undefined;
}

export const remitoController = {
  async createFromSale(req: Request, res: Response) {
    try {
      const saleId = getParamAsString(req.params.saleId, "saleId");

      const remito = await remitoService.createFromSale({
        saleId,
        businessId: req.business!.id,
        userId: getAuthUserId(req),
        placeOfIssue: req.body?.placeOfIssue,
        saleCondition: req.body?.saleCondition,
        transportName: req.body?.transportName,
        transportCuit: req.body?.transportCuit,
        packagesCount:
          req.body?.packagesCount !== undefined &&
          req.body?.packagesCount !== null &&
          req.body?.packagesCount !== ""
            ? Number(req.body.packagesCount)
            : undefined,
        declaredValue:
          req.body?.declaredValue !== undefined &&
          req.body?.declaredValue !== null &&
          req.body?.declaredValue !== ""
            ? Number(req.body.declaredValue)
            : undefined,
        observations: req.body?.observations,
      });

      return res.status(201).json({
        ok: true,
        message: "Remito generado correctamente",
        content: remito,
      });
    } catch (error: any) {
      console.error("Error createFromSale remito:", error);

      return res.status(400).json({
        ok: false,
        message: error.message || "Error al generar remito",
      });
    }
  },

  async getAll(req: Request, res: Response) {
    try {
      const { status, clientId, saleId, from, to } = req.query;

      const remitos = await remitoService.getAll(req.business!.id, {
        status: status ? (String(status) as RemitoStatus) : undefined,
        clientId: clientId ? String(clientId) : undefined,
        saleId: saleId ? String(saleId) : undefined,
        from: from ? String(from) : undefined,
        to: to ? String(to) : undefined,
      });

      return res.json({
        ok: true,
        content: remitos,
      });
    } catch (error: any) {
      console.error("Error getAll remitos:", error);

      return res.status(500).json({
        ok: false,
        message: error.message || "Error al obtener remitos",
      });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const id = getParamAsString(req.params.id, "id");

      const remito = await remitoService.getById(id, req.business!.id);

      return res.json({
        ok: true,
        content: remito,
      });
    } catch (error: any) {
      console.error("Error getById remito:", error);

      return res.status(404).json({
        ok: false,
        message: error.message || "Remito no encontrado",
      });
    }
  },

  async regeneratePdf(req: Request, res: Response) {
    try {
      const id = getParamAsString(req.params.id, "id");

      const remito = await remitoService.regeneratePdf(id, req.business!.id);

      return res.json({
        ok: true,
        message: "PDF del remito regenerado correctamente",
        content: remito,
      });
    } catch (error: any) {
      console.error("Error regeneratePdf remito:", error);

      return res.status(400).json({
        ok: false,
        message: error.message || "Error al regenerar PDF del remito",
      });
    }
  },

  async markAsDelivered(req: Request, res: Response) {
    try {
      const id = getParamAsString(req.params.id, "id");

      const remito = await remitoService.markAsDelivered(id, req.business!.id);

      return res.json({
        ok: true,
        message: "Remito marcado como entregado",
        content: remito,
      });
    } catch (error: any) {
      console.error("Error markAsDelivered remito:", error);

      return res.status(400).json({
        ok: false,
        message: error.message || "Error al marcar remito como entregado",
      });
    }
  },
  async downloadPdf(req: Request, res: Response) {
  try {
    const id = getParamAsString(req.params.id, "id");

    const { buffer, filename } = await remitoService.getPdfBuffer(id, req.business!.id);

    res.setHeader("Content-Type", "application/pdf");

    // attachment = descarga
    // inline = abre en navegador
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    res.setHeader("Content-Length", buffer.length);

    return res.send(buffer);
  } catch (error: any) {
    console.error("Error downloadPdf remito:", error);

    return res.status(400).json({
      ok: false,
      message: error.message || "Error al descargar PDF del remito",
    });
  }
},

  async cancel(req: Request, res: Response) {
    try {
      const id = getParamAsString(req.params.id, "id");

      const remito = await remitoService.cancel(id, req.business!.id);

      return res.json({
        ok: true,
        message: "Remito cancelado correctamente",
        content: remito,
      });
    } catch (error: any) {
      console.error("Error cancel remito:", error);

      return res.status(400).json({
        ok: false,
        message: error.message || "Error al cancelar remito",
      });
    }
  },
};