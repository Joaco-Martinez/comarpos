import type { MetadataRoute } from 'next';

const siteUrl = 'https://www.comarpos.com.ar';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/tienda'],
      disallow: [
        '/api/',
        '/alertas/',
        '/categorias/',
        '/clientes/',
        '/compras/',
        '/configuracion/',
        '/cuentas-corrientes/',
        '/dashboard/',
        '/facturacion/',
        '/finanzas/',
        '/login',
        '/pos/',
        '/productos/',
        '/reportes/',
        '/stock/',
        '/tienda/carrito/',
        '/tienda/cuenta/',
        '/tienda/login/',
        '/tienda/register/',
        '/tienda/reset-password/',
        '/usuarios/',
        '/vendedores/',
        '/ventas/',
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
