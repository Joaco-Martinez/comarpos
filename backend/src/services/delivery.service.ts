import prisma from "../prisma";

const DEFAULT_PRICE_PER_KM = Number(process.env.DELIVERY_PRICE_PER_KM ?? 8000);
const GOOGLE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const GOOGLE_ROUTES_TIMEOUT_MS = Number(process.env.GOOGLE_ROUTES_TIMEOUT_MS ?? 8000);
const DELIVERY_FALLBACK_MULTIPLIER = Number(process.env.DELIVERY_FALLBACK_MULTIPLIER ?? 1.4);

// Google no tiene una opción directa de "ruta más larga".
// Entonces pedimos rutas alternativas y elegimos la de mayor distancia.
const GOOGLE_ROUTES_USE_LONGEST_ALTERNATIVE =
  String(process.env.GOOGLE_ROUTES_USE_LONGEST_ALTERNATIVE ?? "true").toLowerCase() !==
  "false";

type DeliveryRouteSource = "GOOGLE_ROUTES" | "COORDINATES_FALLBACK";

type GoogleRoutesResponse = {
  routes?: {
    distanceMeters?: number;
    duration?: string;
  }[];
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function isValidCoordinate(lat: unknown, lng: unknown) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function parseGoogleDurationSeconds(duration?: string | null) {
  if (!duration) return null;

  const match = duration.match(/^(\d+(?:\.\d+)?)s$/);
  if (!match) return null;

  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? seconds : null;
}

function haversineKm(params: {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
}) {
  const earthRadiusKm = 6371;

  const dLat = toRad(params.destinationLat - params.originLat);
  const dLng = toRad(params.destinationLng - params.originLng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(params.originLat)) *
      Math.cos(toRad(params.destinationLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function buildClientAddress(client: {
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressFloor?: string | null;
  addressApartment?: string | null;
  addressCity?: string | null;
  addressProvince?: string | null;
  addressPostalCode?: string | null;
  addressNotes?: string | null;
}) {
  const street = [client.addressStreet, client.addressNumber].filter(Boolean).join(" ");

  const floor = [
    client.addressFloor ? `Piso ${client.addressFloor}` : "",
    client.addressApartment ? `Dto ${client.addressApartment}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const city = [client.addressCity, client.addressProvince, client.addressPostalCode]
    .filter(Boolean)
    .join(", ");

  return [street, floor, city, client.addressNotes].filter(Boolean).join(" - ");
}

function buildLocationAddress(location: {
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressCity?: string | null;
  addressProvince?: string | null;
  addressPostalCode?: string | null;
  addressNotes?: string | null;
}) {
  const street = [location.addressStreet, location.addressNumber].filter(Boolean).join(" ");

  const city = [location.addressCity, location.addressProvince, location.addressPostalCode]
    .filter(Boolean)
    .join(", ");

  return [street, city, location.addressNotes].filter(Boolean).join(" - ");
}

function selectGoogleRoute(routes?: GoogleRoutesResponse["routes"]) {
  const validRoutes = (routes ?? []).filter((route) => {
    const distanceMeters = Number(route.distanceMeters);
    return Number.isFinite(distanceMeters) && distanceMeters > 0;
  });

  if (!validRoutes.length) return null;

  if (!GOOGLE_ROUTES_USE_LONGEST_ALTERNATIVE) {
    return {
      route: validRoutes[0],
      routeIndex: 0,
      alternativesCount: validRoutes.length,
      routeStrategy: "DEFAULT_ROUTE" as const,
    };
  }

  let longestRoute = validRoutes[0];
  let longestRouteIndex = 0;

  validRoutes.forEach((route, index) => {
    if (Number(route.distanceMeters) > Number(longestRoute.distanceMeters)) {
      longestRoute = route;
      longestRouteIndex = index;
    }
  });

  return {
    route: longestRoute,
    routeIndex: longestRouteIndex,
    alternativesCount: validRoutes.length,
    routeStrategy: "LONGEST_ALTERNATIVE" as const,
  };
}

async function getGoogleRoute(params: {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
}) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GOOGLE_ROUTES_TIMEOUT_MS);

  try {
    const response = await fetch(GOOGLE_ROUTES_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: params.originLat,
              longitude: params.originLng,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: params.destinationLat,
              longitude: params.destinationLng,
            },
          },
        },
        travelMode: "DRIVE",

        // Importante: TRAFFIC_UNAWARE evita pedir features Pro de tráfico.
        // Para cobrar envíos por km real, alcanza con la ruta por calles.
        routingPreference: "TRAFFIC_UNAWARE",

        // Esto hace que Google devuelva alternativas.
        // Después nosotros elegimos la de mayor cantidad de metros.
        computeAlternativeRoutes: GOOGLE_ROUTES_USE_LONGEST_ALTERNATIVE,

        units: "METRIC",
        languageCode: "es-AR",
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("Google Routes API error:", response.status, text);
      return null;
    }

    const json = (await response.json()) as GoogleRoutesResponse;
    const selectedRoute = selectGoogleRoute(json.routes);

    if (!selectedRoute) return null;

    const distanceMeters = Number(selectedRoute.route.distanceMeters);

    if (!distanceMeters || !Number.isFinite(distanceMeters)) return null;

    const durationSeconds = parseGoogleDurationSeconds(selectedRoute.route.duration);

    return {
      distanceKm: distanceMeters / 1000,
      durationMinutes: durationSeconds !== null ? round2(durationSeconds / 60) : null,
      routeIndex: selectedRoute.routeIndex,
      alternativesCount: selectedRoute.alternativesCount,
      routeStrategy: selectedRoute.routeStrategy,
    };
  } catch (error) {
    console.error("Google Routes API request failed:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export const deliveryService = {
  async calculate(params: {
    businessLocationId: string;
    clientId: string;
    pricePerKm?: number | null;
  }) {
    const pricePerKm = Number(params.pricePerKm ?? DEFAULT_PRICE_PER_KM);

    if (!Number.isFinite(pricePerKm) || pricePerKm <= 0) {
      throw new Error("El precio por km debe ser mayor a 0");
    }

    const [location, client] = await Promise.all([
      prisma.businessLocation.findUnique({
        where: { id: params.businessLocationId },
        select: {
          id: true,
          name: true,
          isActive: true,
          addressStreet: true,
          addressNumber: true,
          addressCity: true,
          addressProvince: true,
          addressPostalCode: true,
          addressNotes: true,
          latitude: true,
          longitude: true,
        },
      }),
      prisma.client.findUnique({
        where: { id: params.clientId },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          addressStreet: true,
          addressNumber: true,
          addressFloor: true,
          addressApartment: true,
          addressCity: true,
          addressProvince: true,
          addressPostalCode: true,
          addressNotes: true,
          latitude: true,
          longitude: true,
        },
      }),
    ]);

    if (!location) throw new Error("Sucursal/depósito no encontrado");

    if (!location.isActive) {
      throw new Error("La sucursal/depósito seleccionada está inactiva");
    }

    if (!client) throw new Error("Cliente no encontrado");

    if (!isValidCoordinate(location.latitude, location.longitude)) {
      throw new Error("La sucursal/depósito no tiene coordenadas válidas cargadas");
    }

    if (!isValidCoordinate(client.latitude, client.longitude)) {
      throw new Error("El cliente no tiene coordenadas válidas cargadas");
    }

    const originLat = Number(location.latitude);
    const originLng = Number(location.longitude);
    const destinationLat = Number(client.latitude);
    const destinationLng = Number(client.longitude);

    const straightDistanceKm = haversineKm({
      originLat,
      originLng,
      destinationLat,
      destinationLng,
    });

    let source: DeliveryRouteSource = "COORDINATES_FALLBACK";
    let durationMinutes: number | null = null;
    let routeIndex: number | null = null;
    let alternativesCount: number | null = null;
    let routeStrategy: "LONGEST_ALTERNATIVE" | "DEFAULT_ROUTE" | "FALLBACK" = "FALLBACK";

    const googleRoute = await getGoogleRoute({
      originLat,
      originLng,
      destinationLat,
      destinationLng,
    });

    let distanceKm: number;

    if (googleRoute) {
      source = "GOOGLE_ROUTES";
      distanceKm = googleRoute.distanceKm;
      durationMinutes = googleRoute.durationMinutes;
      routeIndex = googleRoute.routeIndex;
      alternativesCount = googleRoute.alternativesCount;
      routeStrategy = googleRoute.routeStrategy;
    } else {
      const multiplier =
        Number.isFinite(DELIVERY_FALLBACK_MULTIPLIER) && DELIVERY_FALLBACK_MULTIPLIER > 0
          ? DELIVERY_FALLBACK_MULTIPLIER
          : 1.4;

      distanceKm = straightDistanceKm * multiplier;
    }

    const roundedDistanceKm = round2(distanceKm);
    const deliveryCost = round2(roundedDistanceKm * pricePerKm);

    // Ofrecemos 3 opciones de costo al vendedor (más un promedio), ya que
    // la distancia estimada puede variar según tráfico, ruta elegida, etc.
    const shortDistanceKm = round2(straightDistanceKm * 1.1);
    const longDistanceKm = round2(roundedDistanceKm * 1.15);

    const options = [
      {
        key: "SHORT" as const,
        label: "Ruta corta",
        distanceKm: shortDistanceKm,
        deliveryCost: round2(shortDistanceKm * pricePerKm),
      },
      {
        key: "CALCULATED" as const,
        label: "Ruta calculada",
        distanceKm: roundedDistanceKm,
        deliveryCost,
      },
      {
        key: "LONG" as const,
        label: "Ruta con margen",
        distanceKm: longDistanceKm,
        deliveryCost: round2(longDistanceKm * pricePerKm),
      },
    ];

    const averageDistanceKm = round2(
      options.reduce((sum, option) => sum + option.distanceKm, 0) / options.length,
    );
    const averageDeliveryCost = round2(
      options.reduce((sum, option) => sum + option.deliveryCost, 0) / options.length,
    );

    const average = {
      key: "AVERAGE" as const,
      label: "Promedio",
      distanceKm: averageDistanceKm,
      deliveryCost: averageDeliveryCost,
    };

    const originAddress = buildLocationAddress(location);
    const destinationAddress = buildClientAddress(client);

    return {
      distanceKm: roundedDistanceKm,
      straightDistanceKm: round2(straightDistanceKm),
      durationMinutes,
      pricePerKm,
      deliveryCost,
      options,
      average,
      source,

      // Info extra para saber qué hizo el backend.
      routeStrategy,
      routeIndex,
      alternativesCount,

      businessLocationId: location.id,
      businessLocationName: location.name,
      clientId: client.id,
      clientName: `${client.nombre} ${client.apellido}`.trim(),
      originAddress,
      destinationAddress,
      deliveryAddressSnapshot: destinationAddress,
    };
  },
};