import { Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import { Printbox } from "@prisma/client";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      printbox?: Printbox;
    }
  }
}

// Autenticación de dispositivos Printbox (ESP32 + W5500). El device manda
// únicamente `Authorization: Bearer <token>`: nunca un businessId. El token
// es lo único que lo liga a un negocio, así que un box físicamente no puede
// pedir (ni recibir) tickets de otro negocio.
export async function printboxAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, error: "Token requerido" });
  }

  const token = authorization.replace("Bearer ", "").trim();

  if (!token) {
    return res.status(401).json({ ok: false, error: "Token requerido" });
  }

  const printbox = await prisma.printbox.findUnique({ where: { token } });

  if (!printbox || !printbox.isActive) {
    return res.status(401).json({ ok: false, error: "Token inválido" });
  }

  req.printbox = printbox;
  next();
}
