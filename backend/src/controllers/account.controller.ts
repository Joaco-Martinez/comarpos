import { Request, Response, NextFunction } from "express";
import { AccountMovementType, PaymentMethod } from "@prisma/client";
import { accountService } from "../services/account.service";
import { getParamAsString } from "../utils/params";
import { optionalRangeAR } from "../utils/dateAR";
function toNumber(value: any) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toBoolean(value: any) {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return Boolean(value);
}

export const accountController = {
  async getClientAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const { clientId } = req.params;

      const businessId = req.business!.id;

      const result = await accountService.getClientAccount(getParamAsString(clientId, "clientId"), businessId);

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getMovements(req: Request, res: Response, next: NextFunction) {
    try {
      const type = req.query.type as AccountMovementType | undefined;

      const { start: fromDate, end: toDate } = optionalRangeAR(
        req.query.fromDate as string | undefined,
        req.query.toDate as string | undefined
      );

      const movements = await accountService.getMovements(req.business!.id, {
        clientId: req.query.clientId as string | undefined,
        type,
        fromDate,
        toDate,
      });

      res.json(movements);
    } catch (err) {
      next(err);
    }
  },

  async getDebtors(req: Request, res: Response, next: NextFunction) {
    try {
      const debtors = await accountService.getDebtors(req.business!.id);

      res.json(debtors);
    } catch (err) {
      next(err);
    }
  },

  async registerPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { clientId } = req.params;
      const userId = (req as any).user?.id;

      const amount = toNumber(req.body.amount);

      if (!amount) {
        return res.status(400).json({
          message: "amount es requerido y debe ser mayor a 0",
        });
      }

      if (!req.body.method) {
        return res.status(400).json({
          message: "method es requerido",
        });
      }

      const result = await accountService.registerPayment(req.business!.id, {
        clientId: getParamAsString(req.params.clientId, "clientId"),
        amount,
        method: req.body.method as PaymentMethod,
        userId,
        reference: req.body.reference ?? null,
        description: req.body.description ?? null,
      });

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async createAdjustment(req: Request, res: Response, next: NextFunction) {
    try {
      const { clientId } = req.params;
      const userId = (req as any).user?.id;

      const amount = toNumber(req.body.amount);

      if (!amount) {
        return res.status(400).json({
          message: "amount es requerido y debe ser mayor a 0",
        });
      }

      if (!["POSITIVE", "NEGATIVE"].includes(req.body.type)) {
        return res.status(400).json({
          message: "type debe ser POSITIVE o NEGATIVE",
        });
      }

      const result = await accountService.createAdjustment(req.business!.id, {
        clientId: getParamAsString(req.params.clientId, "clientId"),
        type: req.body.type,
        amount,
        userId,
        reference: req.body.reference ?? null,
        description: req.body.description ?? null,
      });

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async updateClientAccountConfig(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { clientId } = req.params;

      const result = await accountService.updateClientAccountConfig(req.business!.id, getParamAsString(clientId, "clientId"), {
        creditLimit:
          req.body.creditLimit === null
            ? null
            : toNumber(req.body.creditLimit),
        isAccountEnabled: toBoolean(req.body.isAccountEnabled),
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};