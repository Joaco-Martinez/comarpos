# ComarPOS — Frontend

Frontend completo de la plataforma SaaS multi-tenant ComarPOS, construido con **Next.js 15**, **React 19**, **TypeScript**, **Axios** y **Zustand**.

## Stack

- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**
- **Axios** — cliente HTTP con cookies automáticas
- **Zustand** — estado global (auth)
- **Recharts** — gráficos y estadísticas
- **Lucide React** — iconos

## Instalación y arranque

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar URL del backend
cp .env.local.example .env.local
# Editar NEXT_PUBLIC_API_URL con la URL de tu backend

# 3. Arrancar en desarrollo
npm run dev

# 4. Build para producción
npm run build && npm start
```

## Módulos incluidos

| Ruta | Módulo |
|------|--------|
| `/login` | Autenticación |
| `/dashboard` | Panel principal con stats y gráficos |
| `/pos` | Punto de venta con carrito |
| `/ventas` | Historial de ventas |
| `/productos` | CRUD de productos |
| `/clientes` | CRUD de clientes |
| `/stock` | Gestión de inventario |
| `/finanzas` | Ingresos / egresos |
| `/alertas` | Alertas de stock crítico |
| `/reportes` | Estadísticas y top productos |
| `/facturacion` | AFIP / facturas electrónicas |
| `/usuarios` | Gestión de usuarios (solo ADMIN) |

## Configuración del backend

El frontend usa cookies httpOnly para la autenticación (el backend las setea automáticamente). Asegurate de que el backend tenga CORS configurado con `credentials: true` para el dominio del frontend.

## Variables de entorno

```env
NEXT_PUBLIC_API_URL=http://localhost:3001  # URL del backend ERP
```
