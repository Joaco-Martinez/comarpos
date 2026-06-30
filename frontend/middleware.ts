// middleware.ts

import { NextRequest, NextResponse } from 'next/server';

type JwtPayload = {
  role?: string;
  user?: {
    role?: string;
  };
  exp?: number;
};

function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');

    // Padding por si el JWT viene sin "="
    const paddedBase64 = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '='
    );

    const json = atob(paddedBase64);

    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getUserRole(req: NextRequest) {
  const token = req.cookies.get('token')?.value;

  if (!token) return null;

  const payload = decodeJwt(token);

  if (!payload) return null;

  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    return null;
  }

  return payload.role || payload.user?.role || null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const role = getUserRole(req);

  const isLogged = Boolean(role);
  const isAdminOrEmployee = role === 'ADMIN' || role === 'EMPLEADO';
  const isClient = role === 'CLIENTE';

  const isHomeRoute = pathname === '/';
  const isTiendaRoute = pathname === '/tienda' || pathname.startsWith('/tienda/');
  const isLoginRoute = pathname === '/login';

  // La tienda es pública.
  // Cualquier persona puede entrar, esté logueada o no.
  if (isHomeRoute || isTiendaRoute) {
    return NextResponse.next();
  }

  // Login:
  // - Si ya es ADMIN o EMPLEADO, lo mando al dashboard.
  // - Si es CLIENTE, lo mando a tienda.
  // - Si no está logueado, puede ver login.
  if (isLoginRoute) {
    if (isAdminOrEmployee) {
      const dashboardUrl = req.nextUrl.clone();
      dashboardUrl.pathname = '/pos';
      return NextResponse.redirect(dashboardUrl);
    }

    if (isClient) {
      const tiendaUrl = req.nextUrl.clone();
      tiendaUrl.pathname = '/';
      return NextResponse.redirect(tiendaUrl);
    }

    return NextResponse.next();
  }

  // Si NO está logueado y quiere entrar al sistema,
  // lo mandamos directo a tienda.
  if (!isLogged) {
    const tiendaUrl = req.nextUrl.clone();
    tiendaUrl.pathname = '/';
    return NextResponse.redirect(tiendaUrl);
  }

  // Si está logueado como CLIENTE e intenta entrar al sistema,
  // lo mandamos a tienda.
  if (isClient) {
    const tiendaUrl = req.nextUrl.clone();
    tiendaUrl.pathname = '/';
    return NextResponse.redirect(tiendaUrl);
  }

  // Solo ADMIN o EMPLEADO pueden entrar al sistema.
  if (!isAdminOrEmployee) {
    const tiendaUrl = req.nextUrl.clone();
    tiendaUrl.pathname = '/';
    return NextResponse.redirect(tiendaUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|txt|xml|webmanifest)$).*)',
  ],
};