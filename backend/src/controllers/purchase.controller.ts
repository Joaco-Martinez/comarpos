import { Request, Response, NextFunction } from "express";
import { purchaseService } from "../services/purchase.service";
import { getParamAsString } from "../utils/params";

export const purchaseController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await purchaseService.getAll(req.business!.id));
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getParamAsString(req.params.id, "id");
      res.json(await purchaseService.getById(id, req.business!.id));
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const purchase = await purchaseService.create(req.body, req.business!.id, userId);
      res.status(201).json(purchase);
    } catch (err) {
      next(err);
    }
  },

  async updateSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getParamAsString(req.params.id, "id");
      const purchase = await purchaseService.updateSupplier(id, req.business!.id, req.body);
      res.json(purchase);
    } catch (err) {
      next(err);
    }
  },

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getParamAsString(req.params.id, "id");
      const userId = (req as any).user?.id;
      const purchase = await purchaseService.cancel(id, req.business!.id, userId);
      res.json(purchase);
    } catch (err) {
      next(err);
    }
  },
};
