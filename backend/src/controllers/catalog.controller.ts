import { Request, Response, NextFunction } from "express";
import { PaymentMethod } from "@prisma/client";
import { catalogService } from "../services/catalog.service";

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

export const catalogController = {
  async getCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await catalogService.getCategories();

      res.json({
        ok: true,
        content: categories,
      });
    } catch (err) {
      next(err);
    }
  },

  async getProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;

      const result = await catalogService.getProducts({
        userId: user?.id,
        categorySlug:
          typeof req.query.category === "string"
            ? req.query.category
            : undefined,
        search:
          typeof req.query.search === "string"
            ? req.query.search
            : undefined,
        limit: toNumber(req.query.limit),
        page: toNumber(req.query.page),
      });

      res.json({
        ok: true,
        content: result,
      });
    } catch (err) {
      next(err);
    }
  },

  async validateCart(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;

      const result = await catalogService.validateCart({
        userId: user?.id,
        businessId: req.business!.id,
        items: Array.isArray(req.body.items)
          ? req.body.items.map((item: any) => ({
              productId: item.productId,
              quantity: toNumber(item.quantity),
              quantityKg: toNumber(item.quantityKg),
            }))
          : [],
      });

      res.json({
        ok: true,
        content: result,
      });
    } catch (err) {
      next(err);
    }
  },

  async checkoutWhatsapp(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;

      const result = await catalogService.checkoutWhatsapp({
        userId: user?.id,
        businessId: req.business!.id,
        items: Array.isArray(req.body.items)
          ? req.body.items.map((item: any) => ({
              productId: item.productId,
              quantity: toNumber(item.quantity),
              quantityKg: toNumber(item.quantityKg),
            }))
          : [],
        paymentMethod: req.body.paymentMethod as PaymentMethod | undefined,
        customerNotes: req.body.customerNotes,
      });

      res.status(201).json({
        ok: true,
        content: result,
      });
    } catch (err) {
      next(err);
    }
  },
};