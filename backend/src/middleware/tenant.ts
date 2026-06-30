import { Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import { Business } from "@prisma/client";

// BASE_DOMAIN, ej "comarpos.com.ar". El subdominio resuelto es todo lo que
// está antes de ese dominio base en el header Host (igual al patrón usado
// por Tiendanube): "grupovj.comarpos.com.ar" -> "grupovj".
const BASE_DOMAIN = process.env.BASE_DOMAIN || "comarpos.com.ar";

// Subdominio reservado para el panel de plataforma (super-admin). En ese
// dominio el middleware no resuelve ningún Business: solo permite el acceso
// si luego el rol del usuario es SUPER_ADMIN (chequeado en las rutas de
// super-admin con requireRole).
const SUPER_ADMIN_SUBDOMAIN = process.env.SUPER_ADMIN_SUBDOMAIN || "admin";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      business?: Business;
      isSuperAdminContext?: boolean;
    }
  }
}

function extractSubdomain(host: string | undefined): string | null {
  if (!host) return null;

  const hostname = host.split(":")[0].trim().toLowerCase();

  // Soporte de desarrollo local: header opcional X-Tenant-Subdomain o el
  // propio hostname siendo "localhost" / una IP, en cuyo caso se espera el
  // override explícito (ver lib/api.ts del frontend).
  if (hostname === "localhost" || hostname === "127.0.0.1" || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return null;
  }

  const base = BASE_DOMAIN.toLowerCase();
  if (!hostname.endsWith(base)) {
    return null;
  }

  const withoutBase = hostname.slice(0, hostname.length - base.length);
  const subdomain = withoutBase.replace(/\.$/, "");

  return subdomain || null;
}

function isSuperAdminPath(req: Request): boolean {
  return req.path.startsWith("/super-admin");
}

export async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  // Rutas de plataforma (super-admin) y health-check: no requieren tenant.
  if (isSuperAdminPath(req) || req.path === "/health" || req.path === "/") {
    req.isSuperAdminContext = true;
    return next();
  }

  const headerOverride = req.headers["x-tenant-subdomain"];
  const queryOverride = req.query.tenant;

  let subdomain = extractSubdomain(req.headers.host);

  // Override solo pensado para desarrollo local (no hay subdominio real en
  // localhost). En producción el browser ya manda el Host correcto.
  if (!subdomain && process.env.NODE_ENV !== "production") {
    if (typeof headerOverride === "string" && headerOverride.trim()) {
      subdomain = headerOverride.trim().toLowerCase();
    } else if (typeof queryOverride === "string" && queryOverride.trim()) {
      subdomain = queryOverride.trim().toLowerCase();
    }
  }

  if (subdomain === SUPER_ADMIN_SUBDOMAIN) {
    req.isSuperAdminContext = true;
    return next();
  }

  if (!subdomain) {
    return res.status(404).json({ message: "Negocio no encontrado: falta subdominio." });
  }

  const business = await prisma.business.findUnique({ where: { subdomain } });

  if (!business) {
    return res.status(404).json({ message: "Negocio no encontrado." });
  }

  if (business.status === "SUSPENDED") {
    return res.status(402).json({ message: "Negocio suspendido por falta de pago." });
  }

  req.business = business;
  next();
}
