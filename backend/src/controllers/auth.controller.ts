import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { getParamAsString } from "../utils/params";

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.business) {
        return res.status(404).json({ message: "Negocio no encontrado." });
      }

      const user = await authService.register(
        {
          email: req.body.email,
          password: req.body.password,
          nombre: req.body.nombre,
          apellido: req.body.apellido,
          name: req.body.name,
          dni: req.body.dni,
          telefono: req.body.telefono,
        },
        req.business.id
      );

      res.status(201).json({
        ok: true,
        content: user,
      });
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const businessId = req.isSuperAdminContext ? null : req.business?.id;

      if (!req.isSuperAdminContext && !req.business) {
        return res.status(404).json({ message: "Negocio no encontrado." });
      }

      const result = await authService.login(email, password, res, businessId ?? null);

      res.json({
        ok: true,
        content: result,
      });
    } catch (err) {
      next(err);
    }
  },

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;

      const result = await authService.changePassword(
        userId,
        req.body.currentPassword,
        req.body.newPassword,
        res
      );

      res.json({
        ok: true,
        content: result,
      });
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.logout(res);

      res.json({
        ok: true,
        content: result,
      });
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.me(req);

      res.json({
        ok: true,
        content: user,
      });
    } catch (err) {
      res.clearCookie("token", { path: "/" });
      res.clearCookie("user", { path: "/" });
      next(err);
    }
  },

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await authService.deleteUser(getParamAsString(id, "id"));

      res.json({
        ok: true,
        content: result,
      });
    } catch (err) {
      next(err);
    }
  },
};
