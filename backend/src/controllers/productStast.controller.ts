import { Request, Response } from "express";
import { productStatsService } from "../services/productStats.service";
import { parseDateInputAR } from "../utils/dateAR";

function parseUnit(unit: any): "UNIT" | "KG" | undefined {
  if (!unit) return undefined;

  const u = String(unit).toUpperCase();

  if (u === "UNIT" || u === "KG") {
    return u;
  }

  return undefined;
}

function parseLimit(limit: any, fallback = 10) {
  const n = Number(limit);

  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(n), 100);
}

function parseDateParam(value: any) {
  if (!value) return null;

  try {
    return parseDateInputAR(String(value).slice(0, 10)) ?? null;
  } catch {
    return null;
  }
}

function getStartDateQuery(req: Request) {
  const { start, from, startDate } = req.query;
  return start ?? from ?? startDate;
}

function getEndDateQuery(req: Request) {
  const { end, to, endDate } = req.query;
  return end ?? to ?? endDate;
}

export const productStatsController = {
  async getTop(req: Request, res: Response) {
    try {
      const { limit = 10, unit } = req.query;

      const stats = await productStatsService.getTopProducts(
        req.business!.id,
        parseLimit(limit, 10),
        parseUnit(unit)
      );

      res.json(stats);
    } catch (error: any) {
      console.error("Error getTop product-stats:", error);
      res.status(500).json({
        error: "Error al obtener productos más vendidos",
        detail: error?.message,
      });
    }
  },

  async getWorst(req: Request, res: Response) {
    try {
      const { limit = 10, unit } = req.query;

      const stats = await productStatsService.getWorstProducts(
        req.business!.id,
        parseLimit(limit, 10),
        parseUnit(unit)
      );

      res.json(stats);
    } catch (error: any) {
      console.error("Error getWorst product-stats:", error);
      res.status(500).json({
        error: "Error al obtener productos menos vendidos",
        detail: error?.message,
      });
    }
  },

  async getTopRange(req: Request, res: Response) {
    try {
      const { limit = 10, unit } = req.query;

      const startDate = parseDateParam(getStartDateQuery(req));
      const endDate = parseDateParam(getEndDateQuery(req));

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: "Faltan fechas",
          detail: "Usá start/end, from/to o startDate/endDate con formato YYYY-MM-DD",
        });
      }

      const stats = await productStatsService.getTopProductsByRange(
        req.business!.id,
        startDate,
        endDate,
        parseLimit(limit, 10),
        parseUnit(unit)
      );

      res.json(stats);
    } catch (error: any) {
      console.error("Error getTopRange product-stats:", error);
      res.status(500).json({
        error: "Error al obtener productos en rango",
        detail: error?.message,
      });
    }
  },

  async getWorstRange(req: Request, res: Response) {
    try {
      const { limit = 10, unit } = req.query;

      const startDate = parseDateParam(getStartDateQuery(req));
      const endDate = parseDateParam(getEndDateQuery(req));

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: "Faltan fechas",
          detail: "Usá start/end, from/to o startDate/endDate con formato YYYY-MM-DD",
        });
      }

      const stats = await productStatsService.getWorstProductsByRange(
        req.business!.id,
        startDate,
        endDate,
        parseLimit(limit, 10),
        parseUnit(unit)
      );

      res.json(stats);
    } catch (error: any) {
      console.error("Error getWorstRange product-stats:", error);
      res.status(500).json({
        error: "Error al obtener productos con menor venta en rango",
        detail: error?.message,
      });
    }
  },

  async getBestMonth(req: Request, res: Response) {
    try {
      const { year, month, unit } = req.query;

      if (!year || !month) {
        return res.status(400).json({
          error: "Faltan parámetros",
          detail: "Debés enviar year y month",
        });
      }

      const stat = await productStatsService.getBestProductByMonth(
        req.business!.id,
        Number(year),
        Number(month),
        parseUnit(unit)
      );

      res.json(stat);
    } catch (error: any) {
      console.error("Error getBestMonth product-stats:", error);
      res.status(500).json({
        error: "Error al obtener producto top del mes",
        detail: error?.message,
      });
    }
  },

  async getWorstMonth(req: Request, res: Response) {
    try {
      const { year, month, unit } = req.query;

      if (!year || !month) {
        return res.status(400).json({
          error: "Faltan parámetros",
          detail: "Debés enviar year y month",
        });
      }

      const stat = await productStatsService.getWorstProductByMonth(
        req.business!.id,
        Number(year),
        Number(month),
        parseUnit(unit)
      );

      res.json(stat);
    } catch (error: any) {
      console.error("Error getWorstMonth product-stats:", error);
      res.status(500).json({
        error: "Error al obtener producto peor del mes",
        detail: error?.message,
      });
    }
  },

  async getTotals(req: Request, res: Response) {
    try {
      const { unit } = req.query;

      const data = await productStatsService.getTotals(req.business!.id, parseUnit(unit));

      res.json(data);
    } catch (error: any) {
      console.error("Error getTotals product-stats:", error);
      res.status(500).json({
        error: "Error al obtener totales de productos",
        detail: error?.message,
      });
    }
  },

  async getTotalsRange(req: Request, res: Response) {
    try {
      const { unit } = req.query;

      const startDate = parseDateParam(getStartDateQuery(req));
      const endDate = parseDateParam(getEndDateQuery(req));

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: "Faltan fechas",
          detail: "Usá start/end, from/to o startDate/endDate con formato YYYY-MM-DD",
        });
      }

      const data = await productStatsService.getTotalsByRange(
        req.business!.id,
        startDate,
        endDate,
        parseUnit(unit)
      );

      res.json(data);
    } catch (error: any) {
      console.error("Error getTotalsRange product-stats:", error);
      res.status(500).json({
        error: "Error al obtener totales por rango",
        detail: error?.message,
      });
    }
  },
};