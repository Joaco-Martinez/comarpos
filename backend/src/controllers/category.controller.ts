
import { Request, Response, NextFunction } from "express";
import { categoryService } from "../services/category.service";
import { getParamAsString } from "../utils/params";
function normalizeBoolean(value: any): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return Boolean(value);
}

function sendServiceResponse(res: Response, result: any, defaultStatus = 200) {
  if (result?.statusCode) {
    return res.status(result.statusCode).json({
      message: result.message,
    });
  }

  return res.status(defaultStatus).json(result);
}

export const categoryController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const includeInactive =
        req.query.includeInactive === "true" || req.query.all === "true";

      const categories = await categoryService.getAll(req.business!.id, {
        includeInactive,
      });

      res.json(categories);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await categoryService.getById(getParamAsString(req.params.id, "id"), req.business!.id);

      if (!category) {
        return res.status(404).json({
          message: "Categoría no encontrada",
        });
      }

      res.json(category);
    } catch (err) {
      next(err);
    }
  },

  async getBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await categoryService.getBySlug(getParamAsString(req.params.slug, "slug"), req.business!.id);

      if (!category) {
        return res.status(404).json({
          message: "Categoría no encontrada",
        });
      }

      res.json(category);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await categoryService.create(req.business!.id, {
        name: req.body.name,
        description: req.body.description,
        isActive: normalizeBoolean(req.body.isActive),
      });

      return sendServiceResponse(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await categoryService.update(getParamAsString(req.params.id, "id"), req.business!.id, {
        name: req.body.name,
        description: req.body.description,
        isActive: normalizeBoolean(req.body.isActive),
      });

      return sendServiceResponse(res, result);
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await categoryService.delete(getParamAsString(req.params.id, "id"), req.business!.id);

      return sendServiceResponse(res, result);
    } catch (err) {
      next(err);
    }
  },

  async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await categoryService.restore(getParamAsString(req.params.id, "id"), req.business!.id);

      return sendServiceResponse(res, result);
    } catch (err) {
      next(err);
    }
  },
};