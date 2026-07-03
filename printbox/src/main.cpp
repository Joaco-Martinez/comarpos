#include <Arduino.h>
#include <SPI.h>
#include <Ethernet.h>
#include <ArduinoHttpClient.h>
#include <ArduinoJson.h>

// ================= W5500 =================
#define W5500_CS    10
#define W5500_SCK   12
#define W5500_MISO  13
#define W5500_MOSI  11

// ================= RED LOCAL =================
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };

IPAddress localIP(192, 168, 123, 50);
IPAddress dns(8, 8, 8, 8);
IPAddress gateway(192, 168, 123, 1);
IPAddress subnet(255, 255, 255, 0);

// ================= IMPRESORA (ESC/POS por red) =================
IPAddress printerIP(192, 168, 123, 100);
const int  PRINTER_PORT = 9100;
EthernetClient printerClient;

// ================= BACKEND / TENANT =================
// Cada printbox se registra UNA sola vez en el backend y recibe un
// DEVICE_TOKEN unico. Ese token es lo unico que identifica al box:
// el backend lo resuelve internamente contra el negocio (tenant) al
// que pertenece. El firmware JAMAS manda un business_id ni nada
// parecido, asi que estructuralmente no hay forma de que este box
// pida (o reciba) tickets de otro negocio.
const char* BACKEND_HOST = "api.tuservicio.com";
const int   BACKEND_PORT = 80;   // pasar a 443 si sumas TLS, ver notas al final
const char* DEVICE_TOKEN = "PRINTBOX_TOKEN_AAAA1111BBBB2222";

const unsigned long POLL_INTERVAL_MS = 3000;      // cada cuanto pregunta si hay algo
const unsigned long POLL_ERROR_BACKOFF_MS = 8000; // si el backend falla, espera mas
unsigned long lastPoll = 0;
unsigned long currentInterval = POLL_INTERVAL_MS;

EthernetClient backendTransport;
HttpClient http(backendTransport, BACKEND_HOST, BACKEND_PORT);

// ================= PROTOTIPOS =================
bool sendChunked(const uint8_t* data, size_t len, int chunkSize = 64, int delayMs = 40);
bool pollForTicket(JsonDocument &doc);
bool printTicket(JsonObject ticket);
void ackTicket(const String &ticketId, bool success);
String padLine(String left, String right, int width = 32);

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println("================================");
  Serial.println("PRINTBOX - polling mode");
  Serial.println("================================");

  SPI.begin(W5500_SCK, W5500_MISO, W5500_MOSI, W5500_CS);
  Ethernet.init(W5500_CS);
  Ethernet.begin(mac, localIP, dns, gateway, subnet);
  delay(1500);

  Serial.print("IP local: ");
  Serial.println(Ethernet.localIP());
  Serial.print("Backend: ");
  Serial.println(BACKEND_HOST);
}

// ================= LOOP PRINCIPAL =================
void loop() {
  // Mantiene el lease DHCP si aplica
  Ethernet.maintain();

  if (Ethernet.linkStatus() == LinkOFF) {
    Serial.println("!! Sin link de red, reintento en el proximo ciclo");
    delay(1000);
    return;
  }

  if (millis() - lastPoll >= currentInterval) {
    lastPoll = millis();

    JsonDocument doc;
    bool hayTicket = pollForTicket(doc);

    if (hayTicket) {
      currentInterval = POLL_INTERVAL_MS; // volvio a andar bien, ritmo normal

      JsonObject ticket = doc.as<JsonObject>();
      String ticketId = ticket["id"] | "";

      Serial.print("[TICKET] nuevo -> id=");
      Serial.println(ticketId);

      bool ok = printTicket(ticket);
      ackTicket(ticketId, ok);
    }
  }
}

// ================= POLLING AL BACKEND =================
// GET /printbox/poll  con Authorization: Bearer <DEVICE_TOKEN>
// Respuestas esperadas del backend:
//   204 No Content -> no hay nada para imprimir todavia
//   200 OK + JSON  -> hay un ticket, viene en el body
//   4xx/5xx/-1     -> error de auth o de red, se backoffea
bool pollForTicket(JsonDocument &doc) {
  http.beginRequest();
  http.get("/printbox/poll");
  http.sendHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
  http.endRequest();

  int statusCode = http.responseStatusCode();

  if (statusCode == 204) {
    http.stop();
    return false;
  }

  if (statusCode != 200) {
    Serial.print("[POLL] status inesperado: ");
    Serial.println(statusCode);
    http.stop();
    currentInterval = POLL_ERROR_BACKOFF_MS;
    return false;
  }

  String body = http.responseBody();
  http.stop();

  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.print("[POLL] JSON invalido: ");
    Serial.println(err.c_str());
    return false;
  }

  return true;
}

// ================= ACK DEL TICKET =================
// POST /printbox/ack/<ticket_id>  con {"status": "printed" | "error"}
// Esto es lo que evita reimprimir el mismo ticket en el proximo poll:
// el backend debe marcarlo como consumido apenas recibe el ack (o
// re-encolarlo si status == "error").
void ackTicket(const String &ticketId, bool success) {
  if (ticketId.length() == 0) return;

  JsonDocument ackDoc;
  ackDoc["status"] = success ? "printed" : "error";

  String payload;
  serializeJson(ackDoc, payload);

  String path = "/printbox/ack/" + ticketId;

  http.beginRequest();
  http.post(path);
  http.sendHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
  http.sendHeader("Content-Type", "application/json");
  http.sendHeader("Content-Length", payload.length());
  http.beginBody();
  http.print(payload);
  http.endRequest();

  int statusCode = http.responseStatusCode();
  http.stop();

  Serial.print("[ACK] ticket ");
  Serial.print(ticketId);
  Serial.print(" -> status ");
  Serial.println(statusCode);
}

// ================= FORMATEO DE LINEAS =================
String padLine(String left, String right, int width) {
  int space = width - (int)left.length() - (int)right.length();
  if (space < 1) {
    int available = width - (int)right.length() - 1;
    left = left.substring(0, available > 0 ? available : 0);
    space = width - (int)left.length() - (int)right.length();
  }
  String out = left;
  for (int i = 0; i < space; i++) out += " ";
  out += right;
  return out;
}

// ================= FORMATEO DE NUMEROS =================
String formatMoney(double v) {
  return String(v, 2);
}

// ================= ARMADO + IMPRESION DEL TICKET =================
// El backend de comarpos arma este JSON con el MISMO esquema que ya usa
// para ticket de venta / factura AFIP / nota de credito / recibo (ver
// buildTicketPayload en backend/src/services/ticket.service.ts y
// backend/src/afip/utils/generarFacturaAfipPDF.ts). El poll le agrega
// "id" y "type" arriba de ese payload. Espera un JSON tipo:
// {
//   "id": "abc123",
//   "type": "SALE_TICKET" | "INVOICE" | "CREDIT_NOTE" | "RECEIPT" | "CASH_CLOSE",
//   "saleId": "TICKET-ABC12345",
//   "receiptType": "TICKET NO FISCAL",
//   "paymentMethod": "Transferencia",
//   "createdAt": "01/07/2026 23:40",
//   "sellerName": "Joaquin",
//   "business": {
//     "name": "COMAR POS",
//     "subtitle": "",
//     "address": "Av. Siempre Viva 123",
//     "cuit": "20-12345678-9",
//     "phone": "11-1234-5678"
//   },
//   "client": { "name": "Juan Perez", "dni": "30111222" },
//   "items": [
//     {"name": "Coca Cola 1.5L", "quantity": 1, "price": 2500, "subtotal": 2500},
//     {"name": "Hamburguesa", "quantity": 2, "price": 9000, "subtotal": 18000}
//   ],
//   "subtotal": 20500,
//   "discount": 500,
//   "total": 20000,
//   "afip": {
//     "invoiceLetter": "B", "pointOfSale": "0007", "cbteNumber": "00001234",
//     "cae": "...", "caeExpiresAt": "10/07/2026"
//   },
//   "footer": "Gracias por su compra!"
// }
// Para "CASH_CLOSE" el payload es distinto: viene pre-formateado como
// texto plano monoespaciado en "raw", listo para mandar directo a la
// impresora sin parsear nada mas.
bool printTicket(JsonObject job) {
  Serial.println("[PRINTER] conectando...");

  if (!printerClient.connect(printerIP, PRINTER_PORT)) {
    Serial.println("ERROR conectando impresora");
    return false;
  }

  String type = job["type"] | "SALE_TICKET";
  String t;
  t += "\x1B\x40"; // init

  if (type == "CASH_CLOSE") {
    t += "\x1B\x61\x00";
    t += String((const char*)(job["raw"] | ""));
    t += "\n\n\n";
  } else {
    JsonObject business = job["business"];
    JsonObject client = job["client"];
    JsonObject afip = job["afip"];

    t += "\x1B\x61\x01";
    t += "\x1B\x45\x01";
    t += String((const char*)(business["name"] | "")) + "\n";
    String subtitle = business["subtitle"] | "";
    if (subtitle.length() > 0) t += subtitle + "\n";
    t += "\x1B\x45\x00";

    String address = business["address"] | "";
    if (address.length() > 0) t += address + "\n";
    String cuit = business["cuit"] | "";
    if (cuit.length() > 0) t += "CUIT: " + cuit + "\n";
    String phone = business["phone"] | "";
    if (phone.length() > 0) t += "Tel: " + phone + "\n";
    t += "-------------------------------\n";

    t += "\x1B\x45\x01";
    t += String((const char*)(job["receiptType"] | "")) + "\n";
    t += "\x1B\x45\x00";
    t += String((const char*)(job["saleId"] | "")) + "\n";
    t += "Fecha: " + String((const char*)(job["createdAt"] | "")) + "\n";

    String sellerName = job["sellerName"] | "";
    if (sellerName.length() > 0) t += "Cajero: " + sellerName + "\n";

    String clientName = client["name"] | "";
    if (clientName.length() > 0) t += "Cliente: " + clientName + "\n";
    String clientDni = client["dni"] | "";
    if (clientDni.length() > 0) t += "DNI/CUIT: " + clientDni + "\n";

    t += "-------------------------------\n";

    t += "\x1B\x61\x00";
    JsonArray items = job["items"];
    for (JsonObject item : items) {
      String name = item["name"] | "";
      double price = item["price"] | 0.0;

      JsonVariant qtyKgVar = item["quantityKg"];
      double qty;
      String qtyLabel;
      if (!qtyKgVar.isNull()) {
        qty = qtyKgVar.as<double>();
        qtyLabel = String(qty, 3) + "kg";
      } else {
        qty = item["quantity"] | 1.0;
        qtyLabel = String((long)qty);
      }

      double subtotalItem = item["subtotal"] | (qty * price);

      String left = qtyLabel + " x " + name;
      String right = "$" + formatMoney(subtotalItem);
      t += padLine(left, right) + "\n";
    }

    t += "-------------------------------\n";
    t += "\x1B\x45\x01";
    t += padLine("SUBTOTAL:", "$" + formatMoney(job["subtotal"] | 0.0)) + "\n";
    double discount = job["discount"] | 0.0;
    if (discount > 0) {
      t += padLine("DESCUENTO:", "$" + formatMoney(discount)) + "\n";
    }
    t += padLine("TOTAL:", "$" + formatMoney(job["total"] | 0.0)) + "\n";
    t += "\x1B\x45\x00";

    t += "-------------------------------\n";
    t += "Pago: " + String((const char*)(job["paymentMethod"] | "")) + "\n";

    if (!afip.isNull()) {
      t += "-------------------------------\n";
      t += "Comp: " + String((const char*)(afip["invoiceLetter"] | "")) + " " +
           String((const char*)(afip["pointOfSale"] | "")) + "-" +
           String((const char*)(afip["cbteNumber"] | "")) + "\n";
      t += "CAE: " + String((const char*)(afip["cae"] | "")) + "\n";
      t += "Vto CAE: " + String((const char*)(afip["caeExpiresAt"] | "")) + "\n";
    }

    t += "\x1B\x61\x01";
    t += "\n";
    t += String((const char*)(job["footer"] | "Gracias por su compra!")) + "\n";
    t += "\n\n\n";
  }

  bool ok = sendChunked((const uint8_t*)t.c_str(), t.length());

  if (!ok) {
    Serial.println("El ticket NO se termino de enviar");
    printerClient.stop();
    return false;
  }

  delay(1500);

  uint8_t feed[] = {0x1B, 0x64, 0x03};
  printerClient.write(feed, sizeof(feed));
  delay(500);

  uint8_t cutA[] = {0x1D, 0x56, 0x42, 0x00};
  printerClient.write(cutA, sizeof(cutA));
  delay(1500);

  printerClient.stop();
  Serial.println("[PRINTER] ticket impreso y conexion cerrada");
  return true;
}

// ================= ENVIO EN CHUNKS =================
bool sendChunked(const uint8_t* data, size_t len, int chunkSize, int delayMs) {
  size_t sent = 0;
  while (sent < len) {
    if (!printerClient.connected()) {
      Serial.print("!! Conexion cortada durante el envio, offset: ");
      Serial.println(sent);
      return false;
    }

    size_t toSend = min((size_t)chunkSize, len - sent);
    size_t written = printerClient.write(data + sent, toSend);

    if (written == 0) {
      delay(50);
      continue;
    }

    sent += written;
    delay(delayMs);
  }
  return true;
}
