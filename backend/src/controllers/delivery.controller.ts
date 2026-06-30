import { Request, Response, NextFunction } from "express";
import { deliveryService } from "../services/delivery.service";

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export const deliveryController = {
  async calculate(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessLocationId, clientId } = req.body;

      if (!businessLocationId) {
        return res.status(400).json({
          ok: false,
          message: "businessLocationId es requerido",
        });
      }

      if (!clientId) {
        return res.status(400).json({
          ok: false,
          message: "clientId es requerido",
        });
      }

      const result = await deliveryService.calculate({
        businessLocationId,
        clientId,
        pricePerKm: toNumber(req.body.pricePerKm),
      });

      return res.json({
        ok: true,
        ...result,
      });
    } catch (error) {
      return next(error);
    }
  },
};
