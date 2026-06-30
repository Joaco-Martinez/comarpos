import { ShopAuthProvider } from '../../context/ShopAuthContext';

const siteUrl = 'https://www.comarpos.com.ar';

const whatsappContacts = [
  {
    label: 'Venta Minorista',
    phone: '5493512332068',
    message: 'Hola! Quiero consultar por una compra minorista.',
  },
  {
    label: 'Venta Mayorista',
    phone: '5493513790057',
    message: 'Hola! Quiero consultar por una compra mayorista.',
  },
  {
    label: 'Comercial',
    phone: '5493516743284',
    message: 'Hola! Quiero comunicarme con el área comercial.',
  },
];

const storeAddresses = [
  {
    name: 'Sucursal San Luis',
    streetAddress: 'San Luis 1481',
    neighborhood: 'Barrio Observatorio',
    city: 'Córdoba Capital',
  },
  {
    name: 'Sucursal Paso de los Andes',
    streetAddress: 'Paso de los Andes 893',
    neighborhood: 'Barrio Observatorio',
    city: 'Córdoba Capital',
  },
];

function WhatsappIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M16.02 3C8.84 3 3 8.74 3 15.8c0 2.5.74 4.88 2.14 6.94L3.8 29l6.44-1.3A13.2 13.2 0 0 0 16.02 29C23.18 29 29 23.26 29 16.2S23.18 3 16.02 3Zm0 23.55c-1.78 0-3.52-.48-5.04-1.4l-.36-.22-3.82.77.8-3.68-.24-.38a10.5 10.5 0 0 1-1.67-5.84c0-5.7 4.63-10.35 10.33-10.35 5.68 0 10.3 4.64 10.3 10.75 0 5.7-4.62 10.35-10.3 10.35Zm5.83-7.77c-.32-.16-1.9-.93-2.2-1.03-.3-.11-.52-.16-.74.16-.21.32-.84 1.03-1.03 1.24-.19.21-.38.24-.7.08-.32-.16-1.35-.5-2.58-1.6-.95-.85-1.6-1.9-1.78-2.22-.19-.32-.02-.5.14-.66.14-.14.32-.38.48-.56.16-.19.21-.32.32-.54.1-.21.05-.4-.03-.56-.08-.16-.74-1.78-1.01-2.44-.27-.64-.54-.56-.74-.57h-.64c-.22 0-.56.08-.86.4-.3.32-1.13 1.1-1.13 2.68s1.16 3.12 1.32 3.33c.16.21 2.28 3.48 5.52 4.88.77.34 1.37.54 1.84.69.77.24 1.48.21 2.04.13.62-.1 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.14-.3-.22-.62-.38Z"
      />
    </svg>
  );
}

export default function ShopPublicShell({
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
      addressLocality: 'Córdoba Capital',
      addressRegion: 'Córdoba',
      addressCountry: 'AR',
    },

    department: storeAddresses.map((address) => ({
      '@type': 'Store',
      name: address.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: address.streetAddress,
        addressLocality: address.city,
        addressRegion: 'Córdoba',
        addressCountry: 'AR',
      },
    })),

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
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />

      <ShopAuthProvider>
        {children}

        <div className="whatsapp-floating">
          <details className="whatsapp-details">
            <summary
              className="whatsapp-main"
              aria-label="Contactar por WhatsApp"
            >
              <WhatsappIcon />
            </summary>

            <div className="whatsapp-menu">
              <div className="whatsapp-menu-head">
                <strong>Contactanos</strong>
                <span>Elegí un sector o consultá nuestras sucursales</span>
              </div>

              <div className="whatsapp-addresses">
                <strong>Sucursales</strong>

                {storeAddresses.map((address) => (
                  <div className="whatsapp-address" key={address.streetAddress}>
                    <span>{address.streetAddress}</span>
                    <small>
                      {address.neighborhood} · {address.city}
                    </small>
                  </div>
                ))}
              </div>

              <div className="whatsapp-links">
                {whatsappContacts.map((contact) => (
                  <a
                    key={contact.phone}
                    href={`https://wa.me/${
                      contact.phone
                    }?text=${encodeURIComponent(contact.message)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whatsapp-link"
                  >
                    <span>{contact.label}</span>
                    <small>+{contact.phone}</small>
                  </a>
                ))}
              </div>
            </div>
          </details>
        </div>
      </ShopAuthProvider>

      <style>{`
        .whatsapp-floating {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 9999;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .whatsapp-details {
          position: relative;
        }

        .whatsapp-details summary {
          list-style: none;
        }

        .whatsapp-details summary::-webkit-details-marker {
          display: none;
        }

        .whatsapp-main {
          width: 58px;
          height: 58px;
          border-radius: 999px;
          background: #25d366;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 16px 34px rgba(37, 211, 102, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.4);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }

        .whatsapp-main:hover {
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 20px 42px rgba(37, 211, 102, 0.45);
        }

        .whatsapp-menu {
          position: absolute;
          right: 0;
          bottom: 72px;
          width: 292px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 22px;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.18);
          padding: 12px;
          opacity: 0;
          transform: translateY(10px) scale(0.96);
          pointer-events: none;
          transition: 0.18s ease;
        }

        .whatsapp-details[open] .whatsapp-menu {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: auto;
        }

        .whatsapp-menu-head {
          padding: 8px 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 3px;
          border-bottom: 1px solid #f1f5f9;
          margin-bottom: 8px;
        }

        .whatsapp-menu-head strong {
          color: #111827;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .whatsapp-menu-head span {
          color: #6b7280;
          font-size: 12px;
          line-height: 1.35;
          font-weight: 600;
        }

        .whatsapp-addresses {
          padding: 10px;
          margin-bottom: 8px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .whatsapp-addresses > strong {
          color: #111827;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .whatsapp-address {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 8px 10px;
          border-radius: 14px;
          background: #f9fafb;
          border: 1px solid #eef2f7;
        }

        .whatsapp-address span {
          color: #111827;
          font-size: 12px;
          font-weight: 900;
        }

        .whatsapp-address small {
          color: #6b7280;
          font-size: 11px;
          line-height: 1.35;
          font-weight: 700;
        }

        .whatsapp-links {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .whatsapp-link {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 12px;
          border-radius: 16px;
          color: #111827;
          text-decoration: none;
          transition: 0.15s ease;
        }

        .whatsapp-link:hover {
          background: #e9f9f1;
          color: #0f9f5c;
        }

        .whatsapp-link span {
          font-size: 13px;
          font-weight: 900;
        }

        .whatsapp-link small {
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
        }

        @media (max-width: 640px) {
          .whatsapp-floating {
            right: 16px;
            bottom: 16px;
          }

          .whatsapp-main {
            width: 54px;
            height: 54px;
          }

          .whatsapp-menu {
            width: calc(100vw - 32px);
            right: -2px;
          }
        }
      `}</style>
    </>
  );
}