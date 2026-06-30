type SendWhatsAppMessageInput = {
  to: string;
  message: string;
};

type SendWhatsAppMessageResult = {
  sent: boolean;
  provider: "WHATSAPP_CLOUD_API";
  messageId?: string;
  error?: string;
  missingConfig?: boolean;
};

function normalizeArgentinaPhone(raw?: string | null) {
  let digits = String(raw || "").replace(/\D/g, "");

  if (!digits) return "";

  // 00354... => 354...
  if (digits.startsWith("00")) digits = digits.slice(2);

  // Ya viene internacional.
  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54")) {
    // Para WhatsApp Argentina móvil suele requerir 549 + área + número.
    if (!digits.startsWith("549")) return `549${digits.slice(2)}`;
    return digits;
  }

  // Teléfonos locales tipo 3512254247 => 5493512254247
  if (digits.startsWith("0")) digits = digits.slice(1);

  // Si cargaron 15 después del código de área: 35115xxxxxxx => 351xxxxxxx
  digits = digits.replace(/^(\d{2,4})15/, "$1");

  return `549${digits}`;
}

function getWhatsappConfig() {
  const token =
    process.env.WHATSAPP_CLOUD_API_TOKEN || process.env.WHATSAPP_TOKEN;
  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID ||
    process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || "v20.0";

  return { token, phoneNumberId, version };
}

export const whatsappService = {
  normalizePhone: normalizeArgentinaPhone,

  async sendTextMessage(
    input: SendWhatsAppMessageInput,
  ): Promise<SendWhatsAppMessageResult> {
    const { token, phoneNumberId, version } = getWhatsappConfig();
    const to = normalizeArgentinaPhone(input.to);

    if (!token || !phoneNumberId) {
      return {
        sent: false,
        provider: "WHATSAPP_CLOUD_API",
        missingConfig: true,
        error:
          "Faltan WHATSAPP_CLOUD_API_TOKEN y/o WHATSAPP_PHONE_NUMBER_ID en el .env",
      };
    }

    if (!to) {
      return {
        sent: false,
        provider: "WHATSAPP_CLOUD_API",
        error: "El cliente no tiene teléfono válido para WhatsApp",
      };
    }

    const res = await fetch(
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: {
            preview_url: false,
            body: input.message,
          },
        }),
      },
    );

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        sent: false,
        provider: "WHATSAPP_CLOUD_API",
        error:
          json?.error?.message ||
          json?.message ||
          `WhatsApp API respondió HTTP ${res.status}`,
      };
    }

    return {
      sent: true,
      provider: "WHATSAPP_CLOUD_API",
      messageId: json?.messages?.[0]?.id,
    };
  },
};
