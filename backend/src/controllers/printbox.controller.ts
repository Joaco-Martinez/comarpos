import { Request, Response } from "express";
import { printboxService } from "../services/printbox.service";

export const printboxController = {
  // GET /printbox/poll — llamado por el ESP32 cada pocos segundos.
  async poll(req: Request, res: Response) {
    try {
      const job = await printboxService.pollNext(req.printbox!.id);

      if (!job) {
        return res.status(204).end();
      }

      return res.status(200).json({
        id: job.id,
        type: job.type,
        ...(job.payload as object),
      });
    } catch (err: any) {
      console.error("❌ Error en printbox poll:", err);
      return res.status(500).json({ ok: false, error: "Error interno" });
    }
  },

  // POST /printbox/ack/:id — el ESP32 confirma si pudo imprimir o no.
  async ack(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id || Array.isArray(id)) {
        return res.status(400).json({ ok: false, error: "id es requerido" });
      }

      const status = req.body?.status === "printed" ? "printed" : "error";

      const job = await printboxService.ack(id, req.printbox!.id, status === "printed", req.body?.error);

      if (!job) {
        return res.status(404).json({ ok: false, error: "Job no encontrado" });
      }

      return res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error("❌ Error en printbox ack:", err);
      return res.status(500).json({ ok: false, error: "Error interno" });
    }
  },

  // ===== Administración =====

  async register(req: Request, res: Response) {
    try {
      const businessId = req.business!.id;
      const printbox = await printboxService.registerDevice(businessId, req.body?.name);
      return res.status(200).json({ ok: true, printbox });
    } catch (err: any) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  },

  async rotateToken(req: Request, res: Response) {
    try {
      const printbox = await printboxService.rotateToken(req.business!.id);
      return res.status(200).json({ ok: true, printbox });
    } catch (err: any) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  },

  async setActive(req: Request, res: Response) {
    try {
      const printbox = await printboxService.setActive(req.business!.id, Boolean(req.body?.isActive));
      return res.status(200).json({ ok: true, printbox });
    } catch (err: any) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  },

  async status(req: Request, res: Response) {
    const printbox = await printboxService.getStatus(req.business!.id);
    return res.status(200).json({ ok: true, printbox });
  },
};
