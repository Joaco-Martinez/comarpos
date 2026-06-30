import type { Metadata } from 'next';
import ShopPublicShell from '@/components/shop/ShopPublicShell';
import ShopPageClient from '@/components/shop/ShopPageClient';

const siteUrl = 'https://www.comarpos.com.ar';

export const metadata: Metadata = {
  title: 'ComarPOS | Tienda online',
  description:
    'Catálogo online potenciado por ComarPOS.',
  alternates: {
    canonical: `${siteUrl}/`,
  },
  openGraph: {
    title: 'ComarPOS | Tienda online',
    description:
      'Tienda online y distribuidora de bebidas en Córdoba. Venta mayorista y minorista para comercios, eventos y clientes particulares.',
    url: `${siteUrl}/`,
    siteName: 'ComarPOS',
    locale: 'es_AR',
    type: 'website',
    images: [
      {
        url: `${siteUrl}/logo-vj-white-transparent.png`,
        width: 512,
        height: 512,
        alt: 'Logo de ComarPOS',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'ComarPOS | Tienda online',
    description:
      'Venta mayorista y minorista de bebidas en Córdoba para comercios, eventos y clientes particulares.',
    images: [`${siteUrl}/logo-vj-white-transparent.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': 180,
      'max-video-preview': -1,
    },
  },
};

export default function Home() {
  return (
    <ShopPublicShell>
      <ShopPageClient />
    </ShopPublicShell>
  );
}
