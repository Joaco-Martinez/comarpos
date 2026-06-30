import axios from "axios";
import forge from "node-forge";
import xml2js from "xml2js";
import prisma from "../prisma";
import { arcaConfigService } from "../services/arcaConfig.service";
import { arcaCryptoService } from "../services/arcaCrypto.service";

const SERVICE_ID = process.env.ARCA_DEFAULT_SERVICE || "wsfe";

function getWsaaUrl(environment: "HOMOLOGACION" | "PRODUCCION") {
  return environment === "HOMOLOGACION"
    ? process.env.ARCA_WSAA_HOMO_URL ||
        "https://wsaahomo.afip.gov.ar/ws/services/LoginCms"
    : process.env.ARCA_WSAA_PROD_URL ||
        "https://wsaa.afip.gov.ar/ws/services/LoginCms";
}

function getSoapValue(body: any) {
  return (
    body?.loginCmsResponse?.loginCmsReturn ||
    body?.["ns1:loginCmsResponse"]?.["ns1:loginCmsReturn"] ||
    body?.["ar:loginCmsResponse"]?.["ar:loginCmsReturn"]
  );
}

export async function generarTokenAFIP() {
  console.log("🔐 Generando nuevo Token/Sign ARCA desde WSAA...");

  const config = await arcaConfigService.getActiveDecrypted();
  const wsaaUrl = getWsaaUrl(config.environment);

  const now = new Date();
  const genTime = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const expTime = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
  const uniqueId = Math.floor(Date.now() / 1000).toString();

  const xml = `
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${genTime}</generationTime>
    <expirationTime>${expTime}</expirationTime>
  </header>
  <service>${SERVICE_ID}</service>
</loginTicketRequest>`.trim();

  const certificate = forge.pki.certificateFromPem(config.certPem);
  const privateKey = forge.pki.privateKeyFromPem(config.keyPem);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(xml, "utf8");
  p7.addCertificate(certificate);
  p7.addSigner({
     key: privateKey,
  certificate,
  digestAlgorithm: forge.pki.oids.sha256,
  authenticatedAttributes: [
    {
      type: forge.pki.oids.contentType,
      value: forge.pki.oids.data,
    },
    {
      type: forge.pki.oids.messageDigest,
    },
  ],
});

  p7.sign();

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  const cmsBase64 = Buffer.from(der, "binary").toString("base64");

  const soapEnvelope = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.loginCms/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:loginCms>
      <ar:in0>${cmsBase64}</ar:in0>
    </ar:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`.trim();

  try {
    const { data } = await axios.post(wsaaUrl, soapEnvelope, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "loginCms",
      },
      timeout: 15000,
    });

    const parsed = await xml2js.parseStringPromise(data, {
      explicitArray: false,
    });

    const envelope =
      parsed["SOAP-ENV:Envelope"] ||
      parsed["soapenv:Envelope"] ||
      parsed["env:Envelope"] ||
      parsed["S:Envelope"];

    if (!envelope) {
      throw new Error("No se encontró Envelope en la respuesta WSAA.");
    }

    const body =
      envelope["SOAP-ENV:Body"] ||
      envelope["soapenv:Body"] ||
      envelope["env:Body"] ||
      envelope["S:Body"];

    if (!body) {
      throw new Error("No se encontró Body en la respuesta WSAA.");
    }

    const fault =
      body["SOAP-ENV:Fault"] ||
      body["soapenv:Fault"] ||
      body["env:Fault"] ||
      body["S:Fault"];

    if (fault) {
      const msg = fault.faultstring || fault["faultstring"] || "Error desconocido en respuesta SOAP";
      throw new Error(`WSAA devolvió Fault: ${msg}`);
    }

    const loginCmsReturn = getSoapValue(body);

    if (!loginCmsReturn) {
      throw new Error("No se encontró loginCmsResponse en la respuesta WSAA.");
    }

    const parsedToken = await xml2js.parseStringPromise(loginCmsReturn, {
      explicitArray: false,
    });

    const credentials = parsedToken?.loginTicketResponse?.credentials;
    const header = parsedToken?.loginTicketResponse?.header;

    if (!credentials?.token || !credentials?.sign || !header?.expirationTime) {
      throw new Error("La respuesta WSAA no contiene token, sign o expirationTime.");
    }

    const token = credentials.token;
    const sign = credentials.sign;
    const expiration = new Date(header.expirationTime);

    await prisma.afipToken.upsert({
      where: {
        arcaConfigId_service: {
          arcaConfigId: config.id,
          service: SERVICE_ID,
        },
      },
      update: {
        tokenEncrypted: arcaCryptoService.encrypt(token),
        signEncrypted: arcaCryptoService.encrypt(sign),
        expiration,
      },
      create: {
        arcaConfigId: config.id,
        service: SERVICE_ID,
        tokenEncrypted: arcaCryptoService.encrypt(token),
        signEncrypted: arcaCryptoService.encrypt(sign),
        expiration,
      },
    });

    await prisma.arcaConfig.update({
      where: { id: config.id },
      data: {
        lastTokenAt: new Date(),
        lastCheckAt: new Date(),
        lastError: null,
        status: "ACTIVE",
      },
    });

    console.log("✅ Token ARCA válido hasta:", expiration);

    return {
      token,
      sign,
      expiration,
      service: SERVICE_ID,
    };
  } catch (error: any) {
    await arcaConfigService.markError(
      config.id,
      error?.message || "Error WSAA"
    );

    throw error;
  }
}

export async function getValidToken() {
  const config = await arcaConfigService.getActive();

  let tokenRow = await prisma.afipToken.findUnique({
    where: {
      arcaConfigId_service: {
        arcaConfigId: config.id,
        service: SERVICE_ID,
      },
    },
  });

  const now = new Date();

  if (!tokenRow || now >= tokenRow.expiration) {
    console.log("⚠️ Token ARCA vencido o inexistente. Generando nuevo...");

    await generarTokenAFIP();

    tokenRow = await prisma.afipToken.findUnique({
      where: {
        arcaConfigId_service: {
          arcaConfigId: config.id,
          service: SERVICE_ID,
        },
      },
    });
  }

  if (!tokenRow) {
    throw new Error("No se pudo obtener token ARCA.");
  }

  return {
    token: arcaCryptoService.decrypt(tokenRow.tokenEncrypted),
    sign: arcaCryptoService.decrypt(tokenRow.signEncrypted),
    expiration: tokenRow.expiration,
    service: tokenRow.service,
  };
}

export const generarTokenARCA = generarTokenAFIP;