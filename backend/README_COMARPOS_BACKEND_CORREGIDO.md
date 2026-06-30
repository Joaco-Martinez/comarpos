# Backend ComarPOS corregido

Este ZIP fue limpiado para dejar una sola configuración fiscal ARCA/AFIP para ComarPOS.

## Cambios principales

- Se dejó un único módulo activo de configuración ARCA en:
  - `src/services/arcaConfig.service.ts`
  - `src/controllers/arcaConfig.controller.ts`
  - `src/routes/arcaConfig.routes.ts`
- Se desactivó el módulo duplicado viejo en `src/afip/_legacy-disabled/` para que no compile ni choque con Prisma.
- Se corrigió WSAA para usar `AfipToken` con:
  - `service`
  - `tokenEncrypted`
  - `signEncrypted`
  - unique compuesto `arcaConfigId_service`
- Se corrigió WSFE para usar `pointsOfSale` / `defaultPointOfSale` en vez de `pointOfSale` directo.
- Se agregó alias de rutas:
  - `/arca-config`
  - `/afip/configuracion`
- Se dejaron endpoints compatibles con el frontend de configuración AFIP.

## Instalación

```bash
npm install
npx prisma generate
npx prisma migrate dev --name arca_config_grupo_vj
npm run dev
```

En producción:

```bash
npx prisma migrate deploy
npx prisma generate
npm run build
npm start
```

## Variables importantes

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="..."
ARCA_CREDENTIALS_SECRET="grupo-vj-clave-super-segura-de-32-caracteres-minimo"
ARCA_DEFAULT_SERVICE="wsfe"
ARCA_WSAA_HOMO_URL="https://wsaahomo.afip.gov.ar/ws/services/LoginCms"
ARCA_WSAA_PROD_URL="https://wsaa.afip.gov.ar/ws/services/LoginCms"
ARCA_WSFE_HOMO_URL="https://wswhomo.afip.gov.ar/wsfev1/service.asmx"
ARCA_WSFE_PROD_URL="https://servicios1.afip.gov.ar/wsfev1/service.asmx"
```

## Endpoints ARCA principales

```txt
GET    /afip/configuracion
PUT    /afip/configuracion/config
POST   /afip/configuracion
POST   /afip/configuracion/certificados
DELETE /afip/configuracion/certificados
PATCH  /afip/configuracion/activate
POST   /afip/configuracion/test/wsaa
POST   /afip/configuracion/test/wsfe-dummy
GET    /afip/configuracion/puntos-venta
POST   /afip/configuracion/puntos-venta
DELETE /afip/configuracion/puntos-venta/:id
GET    /afip/configuracion/remitos-cai
POST   /afip/configuracion/remitos-cai
DELETE /afip/configuracion/remitos-cai/:id
GET    /afip/configuracion/auditoria
```

También quedan disponibles en `/arca-config`.

## Nota

No se incluye `node_modules`. Instalalo con `npm install`.
