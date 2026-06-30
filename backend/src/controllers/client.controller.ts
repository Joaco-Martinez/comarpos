import { Request, Response, NextFunction } from "express";
import { clientService } from "../services/client.service";
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

function normalizeClientBody(body: any) {
  const clean = { ...body };

  clean.creditLimit = toNumberOrNull(body.creditLimit);

  clean.isAccountEnabled = toBoolean(body.isAccountEnabled);
  clean.createUser = toBoolean(body.createUser);
  clean.unlinkUser = toBoolean(body.unlinkUser);

  clean.latitude = toNumberOrNull(body.latitude);
  clean.longitude = toNumberOrNull(body.longitude);

  return clean;
}

export const clientController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.business) {
        return res.status(404).json({ ok: false, message: "Negocio no encontrado." });
      }

      const client = await clientService.createClient(
        normalizeClientBody(req.body),
        req.business.id
      );

      res.status(201).json({
        ok: true,
        client,
      });
    } catch (error) {
      next(error);
    }
  },

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.business) {
        return res.status(404).json({ ok: false, message: "Negocio no encontrado." });
      }

      const clients = await clientService.getClients(req.business.id);

      res.json({
        ok: true,
        clients,
      });
    } catch (error) {
      next(error);
    }
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;

      await clientService.requestPasswordReset(email);

      res.json({
        ok: true,
        message:
          "Si el email está registrado, te enviamos un enlace para restablecer la contraseña",
      });
    } catch (error) {
      next(error);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body;

      await clientService.resetPassword(token, password);

      res.json({
        ok: true,
        message: "Contraseña actualizada correctamente",
      });
    } catch (error) {
      next(error);
    }
  },

  async registerFromStore(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.business) {
        return res.status(404).json({ ok: false, message: "Negocio no encontrado." });
      }

      const client = await clientService.registerStoreClient(
        {
          ...req.body,
          latitude: toNumberOrNull(req.body.latitude) ?? null,
          longitude: toNumberOrNull(req.body.longitude) ?? null,
        },
        req.business.id
      );

      res.status(201).json({
        ok: true,
        message: "Cuenta creada correctamente",
        client,
      });
    } catch (error) {
      next(error);
    }
  },

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.business) {
        return res.status(404).json({ ok: false, message: "Negocio no encontrado." });
      }

      const { id } = req.params;
      const client = await clientService.getClientById(
        getParamAsString(id, "id"),
        req.business.id
      );

      if (!client) {
        return res.status(404).json({
          ok: false,
          message: "Cliente no encontrado",
        });
      }

      res.json({
        ok: true,
        client,
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.business) {
        return res.status(404).json({ ok: false, message: "Negocio no encontrado." });
      }

      const { id } = req.params;
      const body = normalizeClientBody(req.body);

      if (body.creditLimit !== undefined) {
        body.creditLimit = body.creditLimit ?? null;
      }

      const client = await clientService.updateClient(
        getParamAsString(id, "id"),
        req.business.id,
        body
      );

      res.json({
        ok: true,
        client,
      });
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.business) {
        return res.status(404).json({ ok: false, message: "Negocio no encontrado." });
      }

      const { id } = req.params;
      await clientService.deleteClient(getParamAsString(id, "id"), req.business.id);

      res.json({
        ok: true,
        message: "Cliente eliminado correctamente",
      });
    } catch (error) {
      next(error);
    }
  },
};
