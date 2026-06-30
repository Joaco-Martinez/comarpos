import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

type JwtPayload = {
  userId: string;
  role: string;
  businessId?: string | null;
};

function readToken(req: Request) {
  const cookieToken = req.cookies?.token;
  const authorization = req.headers.authorization;

  if (cookieToken) return cookieToken;

  if (authorization?.startsWith("Bearer ")) {
    return authorization.replace("Bearer ", "").trim();
  }

  return null;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = readToken(req);

  if (!token) {
    return res.status(401).json({ message: "Token requerido" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as any).user = { id: decoded.userId, role: decoded.role, businessId: decoded.businessId ?? null };

    // SUPER_ADMIN no pertenece a ningún Business: no validamos contra
    // req.business. Para el resto, si el tenant fue resuelto por subdominio,
    // el usuario debe pertenecer a ese Business (evita usar un token de un
    // negocio para operar sobre el subdominio de otro negocio).
    if (decoded.role !== "SUPER_ADMIN" && req.business && decoded.businessId !== req.business.id) {
      return res.status(403).json({ message: "El usuario no pertenece a este negocio." });
    }

    next();
  } catch (_err) {
    return res.status(401).json({ message: "Token inválido" });
  }
}

export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as any).user = { id: decoded.userId, role: decoded.role, businessId: decoded.businessId ?? null };
  } catch (_err) {
    // En rutas públicas no bloqueamos por token vencido/incorrecto.
    // Simplemente se responde como visitante y el frontend puede pedir login al checkout.
    (req as any).user = undefined;
  }

  next();
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user || user.role !== role) {
      return res.status(403).json({ message: "No autorizado" });
    }

    next();
  };
}

export function requireAnyRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "No autorizado" });
    }

    next();
  };
}
