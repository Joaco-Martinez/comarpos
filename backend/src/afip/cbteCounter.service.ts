import prisma from "../prisma";

export const cbteCounterService = {
  async peekNext(businessId: string, ptoVta: number, cbteTipo: number): Promise<number> {
    const counter = await prisma.cbteCounter.findUnique({
      where: { businessId_ptoVta_cbteTipo: { businessId, ptoVta, cbteTipo } },
    });

    // Si no existe, el “último” es 0
    const last = counter?.lastNumber ?? 0;
    return last + 1;
  },

  async commitUsed(businessId: string, ptoVta: number, cbteTipo: number, usedNumber: number) {
    await prisma.cbteCounter.upsert({
      where: { businessId_ptoVta_cbteTipo: { businessId, ptoVta, cbteTipo } },
      create: { businessId, ptoVta, cbteTipo, lastNumber: usedNumber },
      update: { lastNumber: usedNumber },
    });
  },
};
