import "./config/timezone";
import { processAfipPendingInvoices } from "./cron/afipRetry.worker";

console.log("🚀 Worker AFIP iniciado");

setInterval(async () => {
  try {
    await processAfipPendingInvoices();
  } catch (err: any) {
    console.error("❌ Error en worker AFIP:", err?.message);
  }
}, 60 * 1000); // cada 1 minuto