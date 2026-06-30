import { Request, Response, NextFunction } from "express";
import { PaymentMethod } from "@prisma/client";
import { supplierAccountService } from "../services/supplierAccount.service";
import { getParamAsString } from "../utils/params";

function toNumber(value: any) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export const supplierAccountController = {
  async getBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const supplierId = getParamAsString(req.params.supplierId, "supplierId");
      const result = await supplierAccountService.getBalance(req.business!.id, supplierId);

      res.json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async getMovements(req: Request, res: Response, next: NextFunction) {
    try {
      const supplierId = getParamAsString(req.params.supplierId, "supplierId");
      const movements = await supplierAccountService.getMovements(req.business!.id, supplierId);

      res.json({ ok: true, movements });
    } catch (err) {
      next(err);
    }
  },

  async registerPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const supplierId = getParamAsString(req.params.supplierId, "supplierId");
      const userId = (req as any).user?.id;

      const amount = toNumber(req.body.amount);

      if (!amount) {
        return res.status(400).json({ ok: false, message: "amount es requerido y debe ser mayor a 0" });
      }

      if (!req.body.paymentMethod) {
        return res.status(400).json({ ok: false, message: "paymentMethod es requerido" });
      }

      const movement = await supplierAccountService.registerPayment(
        req.business!.id,
        supplierId,
        amount,
        req.body.paymentMethod as PaymentMethod,
        req.body.reference ?? null,
        req.body.description ?? null,
        userId
      );

      res.status(201).json({ ok: true, movement });
    } catch (err) {
      next(err);
    }
  },

  async createAdjustment(req: Request, res: Response, next: NextFunction) {
    try {
      const supplierId = getParamAsString(req.params.supplierId, "supplierId");
      const userId = (req as any).user?.id;

      const amount = toNumber(req.body.amount);

      if (!amount) {
        return res.status(400).json({ ok: false, message: "amount es requerido y debe ser mayor a 0" });
      }

      if (!["POSITIVE", "NEGATIVE"].includes(req.body.type)) {
        return res.status(400).json({ ok: false, message: "type debe ser POSITIVE o NEGATIVE" });
      }

      const movement = await supplierAccountService.createAdjustment(req.business!.id, {
        supplierId,
        type: req.body.type,
        amount,
        userId,
        reference: req.body.reference ?? null,
        description: req.body.description ?? null,
      });

      res.status(201).json({ ok: true, movement });
    } catch (err) {
      next(err);
    }
  },
};
