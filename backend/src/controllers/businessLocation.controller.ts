import { Request, Response, NextFunction } from "express";
import { businessLocationService } from "../services/businessLocation.service";
import { getParamAsString } from "../utils/params";
import { BusinessLocationType } from "@prisma/client";

function toNumberOrNull(value: any) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toBoolean(value: any) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "1") return true;
  if (value === "0") return false;
  return undefined;
}
function normalizeBody(body: any) {
  const normalized: any = {
    ...body,
    latitude: toNumberOrNull(body.latitude),
    longitude: toNumberOrNull(body.longitude),
  };

  const isDefault = toBoolean(body.isDefault);
  const isActive = toBoolean(body.isActive);

  if (isDefault !== undefined) normalized.isDefault = isDefault;
  if (isActive !== undefined) normalized.isActive = isActive;

  return normalized;
}

function isBusinessLocationType(value: any): value is BusinessLocationType {
  return Object.values(BusinessLocationType).includes(value);
}

export const businessLocationController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = normalizeBody(req.body);

      if (body.type !== undefined && !isBusinessLocationType(body.type)) {
        return res.status(400).json({
          ok: false,
          message: "Tipo inválido. Usá BRANCH, WAREHOUSE o STORE",
        });
      }

      const location = await businessLocationService.create(body);

      res.status(201).json({
        ok: true,
        location,
      });
    } catch (error) {
      next(error);
    }
  },

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const onlyActive = req.query.onlyActive;

      const locations = await businessLocationService.getAll({
        onlyActive:
          onlyActive === undefined ? undefined : toBoolean(onlyActive),
      });

      res.json({
        ok: true,
        locations,
      });
    } catch (error) {
      next(error);
    }
  },

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const location = await businessLocationService.getById(
        getParamAsString(req.params.id, "id")
      );

      if (!location) {
        return res.status(404).json({
          ok: false,
          message: "Sucursal/depósito no encontrado",
        });
      }

      res.json({
        ok: true,
        location,
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const body = normalizeBody(req.body);

      if (body.type !== undefined && !isBusinessLocationType(body.type)) {
        return res.status(400).json({
          ok: false,
          message: "Tipo inválido. Usá BRANCH, WAREHOUSE o STORE",
        });
      }

      const location = await businessLocationService.update(
        getParamAsString(req.params.id, "id"),
        body
      );

      res.json({
        ok: true,
        location,
      });
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await businessLocationService.remove(
        getParamAsString(req.params.id, "id")
      );

      res.json({
        ok: true,
        message: "Sucursal/depósito eliminado correctamente",
      });
    } catch (error) {
      next(error);
    }
  },

  async setDefault(req: Request, res: Response, next: NextFunction) {
    try {
      const location = await businessLocationService.setDefault(
        getParamAsString(req.params.id, "id")
      );

      res.json({
        ok: true,
        location,
      });
    } catch (error) {
      next(error);
    }
  },
};