import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import prisma from "./prisma";
import facturaPdfRoutes from "./routes/factura-pdf.routes";
import { requestLogger, errorLogger } from "./middleware/logger"; 
import { swaggerDocs } from "./config/swagger";
import { authMiddleware, requireRole } from "./middleware/auth";
import { tenantMiddleware } from "./middleware/tenant";
import superAdminRoutes from "./routes/superAdmin.routes";
import afipRoutes from "./afip/afip.routes";
import notaCreditoPdfRoutes from "./routes/notaCreditoPdf.routes";
import alertRoutes from "./routes/alert.routes";
import purchaseRoutes from "./routes/purchase.routes";
import cashClosePrintRouter from "./routes/cashClosePrint.routes";
import userRoutes from "./routes/user.routes";
import authRoutes from "./routes/auth.routes";
import productRoutes from "./routes/product.routes";
import remitoRoutes from "./routes/remito.routes";
import accountRoutes from "./routes/account.routes";
import businessLocationRoutes from "./routes/businessLocation.routes";
import saleRoutes from "./routes/sale.routes";
import categoryRoutes from "./routes/category.routes";
import clientRouter from "./routes/client.routes";
import financeRoutes from "./routes/finance.routes";
import productStatsRoutes from "./routes/productStats.routes";
import deliveryRoutes from "./routes/delivery.routes";
import catalogRoutes from "./routes/catalog.routes";
import arcaConfigRoutes from "./routes/arcaConfig.routes";
import ticketRoutes from "./routes/ticket.routes";
import supplierRoutes from "./routes/supplier.routes";
import supplierAccountRoutes from "./routes/supplierAccount.routes";
dotenv.config();

const app = express();


app.use((req, res, next) => {
  const url = req.url.toLowerCase();

  const forbiddenPatterns = [
    "/.env",
    "/.git",
    "/.aws",
    "/storage",
    "/logs",
    "/debug.log",
    "/error.log",
    "/phpinfo",
    "/info.php",
    "/database.yml",
    "/settings.py",
  ];

  const isForbidden = forbiddenPatterns.some((item) => {
    return url === item || url.startsWith(`${item}/`);
  });

  if (isForbidden) {
    console.warn(`🚨 Bloqueado intento de acceso indebido a: ${req.url}`);
    return res.status(404).send("Not found");
  }

  next();
});

// 🔹 Middlewares globales
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const envOrigins = [
      process.env.FRONTEND_URL,
      process.env.STOREFRONT_URL,
      process.env.ADMIN_FRONTEND_URL,
      process.env.CORS_ORIGINS,
    ]
      .filter(Boolean)
      .flatMap((value) => String(value).split(","))
      .map((value) => value.trim())
      .filter(Boolean);

    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:4000",
      "https://comarpos.vercel.app",
      "https://www.comarpos.com.ar",
      ...envOrigins,
    ];

    // Permitir requests sin Origin (Postman, mobile apps, bots internos)
    if (!origin) {
      return callback(null, true);
    }

    // Validar correctamente
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn("🚫 CORS bloqueado:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json());
app.use(morgan("dev"));
app.use(requestLogger);
app.use((req, _res, next) => {
  console.log("➡️ Entró un request:", req.method, req.url);
  next();
});

// 🔹 Health-check (no requiere tenant)
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// 🔹 Ruta de prueba de conexión
app.get("/", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany();
    res.json({ ok: true, users });
  } catch (err) {
    next(err);
  }
});

// 🔹 Resolución de tenant por subdominio (igual a Tiendanube). Exceptúa
// /super-admin/* y /health (ver tenantMiddleware). Debe ir antes de las
// rutas de negocio para que req.business esté disponible en ellas.
app.use(tenantMiddleware);

// 🔹 Rutas de plataforma (super-admin), requieren rol SUPER_ADMIN, no tenant.
app.use("/super-admin", authMiddleware, requireRole("SUPER_ADMIN"), superAdminRoutes);

// 🔹 Rutas
app.use("/factura-pdf", facturaPdfRoutes);
app.use("/auth", authRoutes);
app.use("/products", productRoutes);
app.use("/catalog", catalogRoutes);
app.use("/users", authMiddleware, requireRole("ADMIN"), userRoutes);
app.use("/sales", saleRoutes);
app.use("/accounts", accountRoutes);
app.use("/categories", categoryRoutes);
app.use("/purchases", purchaseRoutes);
app.use("/suppliers", supplierRoutes);
app.use("/supplier-accounts", supplierAccountRoutes);
app.use("/nota-credito-pdf", notaCreditoPdfRoutes);
app.use("/finance", financeRoutes);
app.use("/clients", clientRouter);
app.use("/cash-close", cashClosePrintRouter);
app.use("/business-locations", businessLocationRoutes);
app.use("/tickets", ticketRoutes);
app.use("/remitos", remitoRoutes);
app.use("/delivery", deliveryRoutes);
app.use("/arca-config", arcaConfigRoutes);
app.use("/afip/configuracion", arcaConfigRoutes);
app.use("/alerts", alertRoutes);
app.use("/product-stats", authMiddleware, productStatsRoutes);
app.use("/afip", afipRoutes);

// 🔹 Swagger
swaggerDocs(app);

// 🔹 Logger de errores
app.use(errorLogger);

export default app;
