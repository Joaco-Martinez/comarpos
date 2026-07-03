import crypto from "crypto";
import prisma from "../prisma";
import { PrintJobType } from "@prisma/client";

function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

export const printboxService = {
  // Encola un trabajo de impresión para el Printbox del negocio. Si el
  // negocio todavía no tiene un Printbox registrado (o está desactivado),
  // no hay a quién imprimirle: se loguea y se sigue de largo en vez de
  // romper el flujo que llamó a esto (venta, factura, etc. ya se guardaron
  // en base independientemente de si hay impresora conectada).
  async enqueueJob(businessId: string, type: PrintJobType, payload: unknown) {
    const printbox = await prisma.printbox.findUnique({ where: { businessId } });

    if (!printbox || !printbox.isActive) {
      console.warn(
        `⚠️ Printbox: negocio ${businessId} no tiene un dispositivo activo, no se encoló el job de tipo ${type}.`
      );
      return null;
    }

    return prisma.printJob.create({
      data: {
        businessId,
        printboxId: printbox.id,
        type,
        payload: payload as any,
      },
    });
  },

  async pollNext(printboxId: string) {
    await prisma.printbox.update({
      where: { id: printboxId },
      data: { lastSeenAt: new Date() },
    });

    return prisma.printJob.findFirst({
      where: { printboxId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });
  },

  async ack(jobId: string, printboxId: string, success: boolean, error?: string) {
    const job = await prisma.printJob.findFirst({ where: { id: jobId, printboxId } });

    if (!job) return null;

    return prisma.printJob.update({
      where: { id: jobId },
      data: {
        status: success ? "PRINTED" : "ERROR",
        error: success ? null : error || "Error de impresión",
        printedAt: success ? new Date() : job.printedAt,
      },
    });
  },

  // ===== Administración (llamado desde el panel, con sesión de negocio) =====

  async registerDevice(businessId: string, name?: string) {
    const token = generateToken();

    return prisma.printbox.upsert({
      where: { businessId },
      create: { businessId, name: name || "Printbox", token },
      update: { name: name || undefined, token, isActive: true },
    });
  },

  async rotateToken(businessId: string) {
    const printbox = await prisma.printbox.findUnique({ where: { businessId } });
    if (!printbox) throw new Error("Este negocio no tiene un Printbox registrado");

    return prisma.printbox.update({
      where: { businessId },
      data: { token: generateToken() },
    });
  },

  async setActive(businessId: string, isActive: boolean) {
    const printbox = await prisma.printbox.findUnique({ where: { businessId } });
    if (!printbox) throw new Error("Este negocio no tiene un Printbox registrado");

    return prisma.printbox.update({ where: { businessId }, data: { isActive } });
  },

  async getStatus(businessId: string) {
    return prisma.printbox.findUnique({ where: { businessId } });
  },
};
