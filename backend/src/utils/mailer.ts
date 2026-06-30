import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

export async function sendInvoiceEmail(sale: any, pdfPath: string) {
  // prioridad: mail manual > mail del cliente
  const recipient =
    sale.gmailSend?.trim() ||
    sale.client?.email?.trim() ||
    null;

  if (!recipient) {
    console.log(`⚠️ No se envió email: la venta ${sale.id} no tiene destinatario`);
    return;
  }

  await transporter.sendMail({
    from: `"${process.env.BUSINESS_NAME ?? "ComarPOS"}" <${process.env.GMAIL_USER}>`,
    to: recipient,
    subject: `Factura de compra #${sale.id}`,
    text: "Gracias por tu compra. Te adjuntamos la factura.",
    attachments: [
      {
        filename: `Factura-${sale.id}.pdf`,
        path: pdfPath,
      },
    ],
  });

  console.log(`📧 Factura enviada a ${recipient}`);
}

export async function sendPasswordResetEmail(data: {
  to: string;
  name?: string | null;
  token: string;
}) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    throw new Error("No están configuradas las credenciales de Gmail");
  }

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  const resetUrl = `${frontendUrl.replace(/\/$/, "")}/tienda/reset-password?token=${encodeURIComponent(
    data.token
  )}`;

  await transporter.sendMail({
    from: `"${process.env.BUSINESS_NAME ?? "ComarPOS"}" <${process.env.GMAIL_USER}>`,
    to: data.to,
    subject: "Restablecer contraseña",
    html: `
      <div style="font-family: Arial, sans-serif; background: #f6f6f6; padding: 24px;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 24px; color: #111;">
          <h2 style="margin-top: 0;">Restablecer contraseña</h2>

          <p>Hola ${data.name || ""}, recibimos una solicitud para restablecer tu contraseña.</p>

          <p>Hacé clic en el siguiente botón para crear una nueva contraseña:</p>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" 
               style="background: #111; color: #fff; padding: 14px 22px; border-radius: 8px; text-decoration: none; display: inline-block;">
              Restablecer contraseña
            </a>
          </div>

          <p>Este link vence en 1 hora.</p>

          <p>Si no solicitaste este cambio, podés ignorar este email.</p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />

          <p style="font-size: 12px; color: #777;">
            Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br />
            ${resetUrl}
          </p>
        </div>
      </div>
    `,
  });

  console.log(`📧 Email de recuperación enviado a ${data.to}`);
}