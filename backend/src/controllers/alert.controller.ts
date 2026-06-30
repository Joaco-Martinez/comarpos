import { Request, Response } from "express";
import alertService from "../services/alert.service";

export const getAlerts = async (req: Request, res: Response) => {
  try {
    const alerts = await alertService.getAlerts(req.business!.id);
    res.json(alerts);
  } catch (error) {
    console.error("Error al obtener alertas:", error);
    res.status(500).json({ error: "Error al obtener alertas" });
  }
};

export const checkAllStockAlerts = async (req: Request, res: Response) => {
  try {
    const alerts = await alertService.checkAllProductsStock(req.business!.id);

    res.json({
      ok: true,
      message: "Alertas de stock revisadas correctamente",
      alerts,
    });
  } catch (error) {
    console.error("Error al revisar alertas de stock:", error);
    res.status(500).json({ error: "Error al revisar alertas de stock" });
  }
};