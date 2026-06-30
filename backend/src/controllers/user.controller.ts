import { Request, Response, NextFunction } from "express";
import { userService } from "../services/user.service";
import { getParamAsString } from "../utils/params";

function toNumberOrNull(value: any) {
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

function safeJson(data: any) {
  return JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

export const userController = {
  async updateOwnPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ message: "No autorizado" });
      }

      const { defaultStockLocation, defaultPriceCategory } = req.body;

      const updated = await userService.updateOwnPreferences(userId, {
        defaultStockLocation:
          defaultStockLocation === undefined ? undefined : defaultStockLocation || null,
        defaultPriceCategory:
          defaultPriceCategory === undefined ? undefined : defaultPriceCategory || null,
      });

      res.json(safeJson(updated));
    } catch (err) {
      next(err);
    }
  },

  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const users = await userService.getAll();
      res.json(safeJson(users));
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userService.getById(
        getParamAsString(req.params.id, "id")
      );

      if (!user) {
        return res.status(404).json({
          message: "Usuario no encontrado",
        });
      }

      res.json(safeJson(user));
    } catch (err) {
      next(err);
    }
  },

  async getActivityById(req: Request, res: Response, next: NextFunction) {
    try {
      const activity = await userService.getActivityById(
        getParamAsString(req.params.id, "id"),
        {
          fromDate:
            typeof req.query.fromDate === "string"
              ? req.query.fromDate
              : undefined,
          toDate:
            typeof req.query.toDate === "string"
              ? req.query.toDate
              : undefined,
        }
      );

      if (!activity) {
        return res.status(404).json({
          message: "Usuario no encontrado",
        });
      }

      res.json(safeJson(activity));
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.business) {
        return res.status(404).json({ message: "Negocio no encontrado." });
      }

      const newUser = await userService.create(
        {
          ...req.body,
          creditLimit: toNumberOrNull(req.body.creditLimit),
          isAccountEnabled: toBoolean(req.body.isAccountEnabled),
          isActive: toBoolean(req.body.isActive),
        },
        req.business.id
      );

      res.status(201).json(safeJson(newUser));
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const body = { ...req.body };

      if (body.isActive !== undefined) {
        body.isActive = toBoolean(body.isActive);
      }

      const updated = await userService.update(
        getParamAsString(req.params.id, "id"),
        body
      );

      res.json(safeJson(updated));
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await userService.delete(getParamAsString(req.params.id, "id"));

      res.json({
        message: "Usuario eliminado",
      });
    } catch (err) {
      next(err);
    }
  },
};