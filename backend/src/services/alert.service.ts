import prisma from "../prisma";
import nodemailer from "nodemailer";
import { Product, SaleUnit } from "@prisma/client";

type StockLocationLabel = "LOCAL" | "DEPÓSITO";

const STOCK_ALERT_USER_ID = "f6993644-8467-47c5-9a4a-bd0f38db31a4";

class AlertService {
  async createAlert(
    businessId: string,
    productId: string,
    productName: string,
    stock: number,
    minStock: number,
    unit = "unidades",
    location?: StockLocationLabel
  ) {
    const locationText = location ? ` en ${location}` : "";

    const message = `El producto "${productName}" tiene bajo stock${locationText} (${stock} ${unit}, mínimo ${minStock}).`;

    const existing = await prisma.alert.findFirst({
      where: {
        businessId,
        productId,
        resolved: false,
        message,
      },
    });

    if (existing) return existing;

    const alert = await prisma.alert.create({
      data: { businessId, productId, message },
    });

    try {
      await this.sendEmailToStockAlertUser(
        productName,
        stock,
        minStock,
        unit,
        location
      );
    } catch (error) {
      console.error("Error enviando alerta por email:", error);
    }

    return alert;
  }

  async checkProductStock(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) return [];

    return this.checkProductStockFromData(product);
  }

  // NOTA: `product.businessId` viene de la propia fila de Product, que ya
  // está scoped al negocio dueño del producto. No hace falta recibir un
  // businessId aparte porque siempre derivamos del producto cargado.

  async checkProductStockFromData(product: Product) {
    const alerts: {
      id: string;
      productId: string;
      message: string;
      createdAt: Date;
      resolved: boolean;
    }[] = [];

    if (product.isService) return alerts;
    if (!product.isActive) return alerts;

    if (product.saleUnit === SaleUnit.KG) {
      const minStockLocalKg = Number(product.minStockKg ?? 0);
      const minStockDepositoKg = Number(product.minStockDepositoKg ?? 0);

      const stockLocalKg = Number(product.stockLocalKg ?? 0);
      const stockDepositoKg = Number(product.stockDepositoKg ?? 0);

      if (minStockLocalKg > 0 && stockLocalKg <= minStockLocalKg) {
        const alert = await this.createAlert(
          product.businessId,
          product.id,
          product.name,
          stockLocalKg,
          minStockLocalKg,
          "kg",
          "LOCAL"
        );

        alerts.push(alert);
      }

      if (minStockDepositoKg > 0 && stockDepositoKg <= minStockDepositoKg) {
        const alert = await this.createAlert(
          product.businessId,
          product.id,
          product.name,
          stockDepositoKg,
          minStockDepositoKg,
          "kg",
          "DEPÓSITO"
        );

        alerts.push(alert);
      }

      return alerts;
    }

    const minStockLocal = Number(product.minStock ?? 0);
    const minStockDeposito = Number(product.minStockDeposito ?? 0);

    const stockLocal = Number(product.stockLocal ?? 0);
    const stockDeposito = Number(product.stockDeposito ?? 0);

    if (minStockLocal > 0 && stockLocal <= minStockLocal) {
      const alert = await this.createAlert(
        product.businessId,
        product.id,
        product.name,
        stockLocal,
        minStockLocal,
        "unidades",
        "LOCAL"
      );

      alerts.push(alert);
    }

    if (minStockDeposito > 0 && stockDeposito <= minStockDeposito) {
      const alert = await this.createAlert(
        product.businessId,
        product.id,
        product.name,
        stockDeposito,
        minStockDeposito,
        "unidades",
        "DEPÓSITO"
      );

      alerts.push(alert);
    }

    return alerts;
  }

  async checkAllProductsStock(businessId: string) {
    const products = await prisma.product.findMany({
      where: {
        businessId,
        isActive: true,
        isService: false,
      },
    });

    const alerts = [];

    for (const product of products) {
      const productAlerts = await this.checkProductStockFromData(product);
      alerts.push(...productAlerts);
    }

    return alerts;
  }

  async getAlerts(businessId: string) {
    return prisma.alert.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      include: { product: true },
    });
  }

  private async sendEmailToStockAlertUser(
    productName: string,
    stock: number,
    minStock: number,
    unit: string,
    location?: StockLocationLabel
  ) {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) return;

    const user = await prisma.user.findUnique({
      where: {
        id: STOCK_ALERT_USER_ID,
      },
      select: {
        email: true,
      },
    });

    if (!user?.email) return;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    const locationText = location ? ` en ${location}` : "";

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #111; color: #D4AF37;">
        <h2 style="color: #D4AF37; text-align: center;">⚠️ Alerta de Bajo Stock</h2>

        <div style="background: #1c1c1c; padding: 15px; border-radius: 8px; margin-top: 15px;">
          <p style="font-size: 16px; margin: 0; color: #fff;">
            El producto <strong style="color: #D4AF37;">"${productName}"</strong> tiene bajo stock${locationText}.
          </p>

          <p style="font-size: 18px; margin: 10px 0; text-align: center; color: #fff;">
            📦 <strong>${stock}</strong> ${unit} disponibles
            <span style="color: #aaa;">(mínimo ${minStock})</span>
          </p>

          ${
            location
              ? `
                <p style="font-size: 15px; margin: 10px 0 0; text-align: center; color: #D4AF37;">
                  Ubicación: <strong>${location}</strong>
                </p>
              `
              : ""
          }
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"ERP" <${process.env.GMAIL_USER}>`,
      to: user.email,
      subject: `⚠️ Alerta de bajo stock${locationText}`,
      html,
    });
  }
}

export default new AlertService();