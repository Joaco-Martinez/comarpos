import { Request, Response, NextFunction } from "express";
import { supplierService } from "../services/supplier.service";
import { getParamAsString } from "../utils/params";

function toBoolean(value: any) {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return Boolean(value);
}

export const supplierController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const includeInactive = toBoolean(req.query.includeInactive) ?? false;
      const suppliers = await supplierService.listSuppliers(req.business!.id, includeInactive);

      res.json({ ok: true, suppliers });
    } catch (error) {
      next(error);
    }
  },

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getParamAsString(req.params.id, "id");
      const supplier = await supplierService.getSupplier(req.business!.id, id);

      res.json({ ok: true, supplier });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const supplier = await supplierService.createSupplier(req.business!.id, req.body);

      res.status(201).json({ ok: true, supplier });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getParamAsString(req.params.id, "id");
      const body = { ...req.body };

      if (body.isActive !== undefined) body.isActive = toBoolean(body.isActive);

      const supplier = await supplierService.updateSupplier(req.business!.id, id, body);

      res.json({ ok: true, supplier });
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getParamAsString(req.params.id, "id");
      await supplierService.deactivateSupplier(req.business!.id, id);

      res.json({ ok: true, message: "Proveedor desactivado correctamente" });
    } catch (error) {
      next(error);
    }
  },
};
