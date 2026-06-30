import { Request, Response, NextFunction } from "express";
import { superAdminService } from "../services/superAdmin.service";
import { getParamAsString } from "../utils/params";
import { BusinessStatus } from "@prisma/client";

export const superAdminController = {
  async listBusinesses(req: Request, res: Response, next: NextFunction) {
    try {
      const businesses = await superAdminService.listBusinesses();
      res.json({ ok: true, content: businesses });
    } catch (err) {
      next(err);
    }
  },

  async getBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const business = await superAdminService.getBusiness(getParamAsString(req.params.id, "id"));
      res.json({ ok: true, content: business });
    } catch (err) {
      next(err);
    }
  },

  async createBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const business = await superAdminService.createBusiness({
        name: req.body.name,
        subdomain: req.body.subdomain,
        cuit: req.body.cuit,
        rubro: req.body.rubro,
        plan: req.body.plan,
        slug: req.body.slug,
      });
      res.status(201).json({ ok: true, content: business });
    } catch (err) {
      next(err);
    }
  },

  async updateBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const business = await superAdminService.updateBusiness(getParamAsString(req.params.id, "id"), {
        name: req.body.name,
        cuit: req.body.cuit,
        rubro: req.body.rubro,
        plan: req.body.plan,
        modulosActivos: req.body.modulosActivos,
      });
      res.json({ ok: true, content: business });
    } catch (err) {
      next(err);
    }
  },

  async suspendBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const business = await superAdminService.suspend(getParamAsString(req.params.id, "id"));
      res.json({ ok: true, content: business });
    } catch (err) {
      next(err);
    }
  },

  async activateBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const business = await superAdminService.activate(getParamAsString(req.params.id, "id"));
      res.json({ ok: true, content: business });
    } catch (err) {
      next(err);
    }
  },

  async setBusinessStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = req.body.status as BusinessStatus;
      const business = await superAdminService.setStatus(getParamAsString(req.params.id, "id"), status);
      res.json({ ok: true, content: business });
    } catch (err) {
      next(err);
    }
  },

  async markPaymentReceived(req: Request, res: Response, next: NextFunction) {
    try {
      const business = await superAdminService.markPaymentReceived(getParamAsString(req.params.id, "id"));
      res.json({ ok: true, content: business });
    } catch (err) {
      next(err);
    }
  },

  async listSuperAdmins(req: Request, res: Response, next: NextFunction) {
    try {
      const admins = await superAdminService.listSuperAdmins();
      res.json({ ok: true, content: admins });
    } catch (err) {
      next(err);
    }
  },

  async createSuperAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = await superAdminService.createSuperAdmin({
        email: req.body.email,
        password: req.body.password,
        name: req.body.name,
      });
      res.status(201).json({ ok: true, content: admin });
    } catch (err) {
      next(err);
    }
  },

  async deactivateSuperAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = await superAdminService.deactivateSuperAdmin(getParamAsString(req.params.id, "id"));
      res.json({ ok: true, content: admin });
    } catch (err) {
      next(err);
    }
  },
};
