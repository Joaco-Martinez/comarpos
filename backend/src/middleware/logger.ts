import { Request, Response, NextFunction } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const now = new Date().toISOString();
    const duration = Date.now() - start;
    console.log(
      `[${now}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`
    );
  });

  next();
}

export function errorLogger(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const now = new Date().toISOString();
  const statusCode = err.status || 500;

  console.error(`[${now}] ❌ Error en ${req.method} ${req.originalUrl}`);
  console.error(`Código: ${statusCode}`);
  console.error("Detalles:", err);

  res.status(statusCode).json({
    ok: false,
    status: statusCode,
    message: err.message || "Error interno del servidor",
  });
}
