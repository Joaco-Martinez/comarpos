import type { Metadata, Viewport } from 'next';
import './globals.css';


const siteUrl = 'https://www.comarpos.com.ar';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: 'ComarPOS | Plataforma de gestión y venta online',
    template: '%s | ComarPOS',
  },

  description:
    'ComarPOS es una tienda y distribuidora de bebidas en Córdoba. Venta mayorista y minorista de fernet, cervezas, vinos, gaseosas, energizantes, combos y más productos para comercios, eventos y clientes particulares.',

  applicationName: 'ComarPOS',

  keywords: [
    'ComarPOS',
    'ComarPOS',
    'ComarPOS',
    'tienda ComarPOS',
    'tienda de bebidas en Córdoba',
    'bebidas Córdoba',
    'bebidas Argentina',
    'bebidas mayoristas',
    'bebidas minoristas',
    'mayorista de bebidas',
    'minorista de bebidas',
    'distribuidora de bebidas',
    'venta de bebidas',
    'bebidas para comercios',
    'bebidas para eventos',
    'bebidas para clientes particulares',
    'fernet',
    'cervezas',
    'vinos',
    'gaseosas',
    'energizantes',
    'combos de bebidas',
    'ecommerce bebidas',
  ],

  authors: [
    {
      name: 'ComarPOS',
      url: siteUrl,
    },
  ],

  creator: 'ComarPOS',
  publisher: 'ComarPOS',

  alternates: {
    canonical: '/',
    languages: {
      'es-AR': '/',
    },
  },

  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: siteUrl,
    siteName: 'ComarPOS',
    title: 'ComarPOS | Plataforma de gestión y venta online',
    description:
      'Tienda y distribuidora de bebidas en Córdoba. Venta mayorista y minorista para comercios, eventos y clientes particulares.',
    images: [
      {
        url: '/logo-vj-white-transparent.png',
        width: 512,
        height: 512,
        alt: 'Logo de ComarPOS',
      },
    ],
  },

  twitter: {
    card: 'summary',
    title: 'ComarPOS | Plataforma de gestión y venta online',
    description:
      'Venta mayorista y minorista de bebidas en Córdoba para comercios, eventos y clientes particulares.',
    images: ['/logo-vj-white-transparent.png'],
  },

  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-image-preview': 'large',

      /**
       * Limita cuánto texto puede usar Google para el snippet.
       * Esto ayuda a evitar que tome precios/productos sueltos.
       * No lo garantiza al 100%, pero es mejor que dejarlo en -1.
       */
      'max-snippet': 160,

      'max-video-preview': -1,
    },
  },

  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },

  category: 'Tienda de bebidas',

  other: {
    'geo.region': 'AR-X',
    'geo.placename': 'Córdoba, Argentina',
    'og:country-name': 'Argentina',
    'theme-color': '#f4f6f8',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#f4f6f8',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    '@id': `${siteUrl}/#store`,
    name: 'ComarPOS',
    alternateName: 'ComarPOS',
    url: siteUrl,

    description:
      'Tienda y distribuidora de bebidas en Córdoba con venta mayorista y minorista para comercios, eventos y clientes particulares.',

    image: `${siteUrl}/logo-vj-white-transparent.png`,
    logo: `${siteUrl}/logo-vj-white-transparent.png`,

    slogan: 'Bebidas mayoristas y minoristas en Córdoba',

    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Paso de los Andes 893',
      addressLocality: 'Córdoba',
      addressRegion: 'Córdoba',
      addressCountry: 'AR',
    },

    areaServed: [
      {
        '@type': 'AdministrativeArea',
        name: 'Córdoba',
      },
      {
        '@type': 'Country',
        name: 'Argentina',
      },
    ],

    knowsAbout: [
      'Venta mayorista de bebidas',
      'Venta minorista de bebidas',
      'Distribución de bebidas',
      'Bebidas para comercios',
      'Bebidas para eventos',
      'Fernet',
      'Cervezas',
      'Vinos',
      'Gaseosas',
      'Energizantes',
      'Combos de bebidas',
    ],

    makesOffer: [
      {
        '@type': 'Offer',
        name: 'Venta mayorista de bebidas',
        itemOffered: {
          '@type': 'Service',
          name: 'Venta de bebidas para comercios',
          category: 'Bebidas',
        },
      },
      {
        '@type': 'Offer',
        name: 'Venta minorista de bebidas',
        itemOffered: {
          '@type': 'Service',
          name: 'Venta de bebidas para clientes particulares',
          category: 'Bebidas',
        },
      },
    ],

    sameAs: [],
  };

  return (
    <html lang="es-AR">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd),
          }}
        />

        {children}
      </body>
    </html>
  );
}