/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState, type WheelEvent } from "react";
import { createPortal } from "react-dom";
import AppLayout from "@/components/AppLayout";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/api";
import type {
  BusinessLocation,
  CartItem,
  Client,
  DiscountType,
  PaymentMethod,
  Product,
  ProductCategory,
  ReceiptType,
  SalePayment,
} from "@/types";
import {
  categoryName,
  clientName,
  fmtMoney,
  normalizeArray,
  num,
  productPrice,
} from "@/lib/helpers";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  Check,
  Minus,
  Package,
  Plus,
  RefreshCcw,
  ScanBarcode,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  Warehouse,
  X,
} from "lucide-react";

const methods: PaymentMethod[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "TARJETA",
  "DEBITO",
  "CREDITO",
  "QR",
  "QR_MERCADOPAGO",
  "QR_NACION",
  "CUENTA_CORRIENTE",
];

type StockLocation = "LOCAL" | "DEPOSITO";
type DeliveryMode = "PICKUP" | "LOCAL_DELIVERY";
type ProductSortMode = "name-asc" | "name-desc" | "category-asc" | "category-desc";

type DeliveryCalculation = {
  distanceKm: number;
  pricePerKm: number;
  deliveryCost: number;
  durationMinutes?: number | null;
  straightDistanceKm?: number | null;
  source?: "GOOGLE_ROUTES" | "COORDINATES_FALLBACK";
  businessLocationId: string;
  businessLocationName: string;
  clientId: string;
  clientName: string;
  originAddress?: string;
  destinationAddress?: string;
  deliveryAddressSnapshot?: string;
};

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
} | null;

type PendingProductAdd = {
  product: Product;
  priceType: CartItem["priceType"];
} | null;

type ClientGateMode = "question" | "picker" | null;

const DELIVERY_SKU = "ENVIO-FLETE2";
const POS_SKU_SCANNER_ELEMENT_ID = "comarpos-pos-sku-scanner";
const RETAIL_PRICE_TYPE = "price" as CartItem["priceType"];
const WHOLESALE_PRICE_TYPE = "wholesalePrice" as CartItem["priceType"];

function stockLocationLabel(stockLocation: StockLocation) {
  return stockLocation === "DEPOSITO" ? "Minorista" : "Mayorista";
}

function stockLocationLabelLower(stockLocation: StockLocation) {
  return stockLocation === "DEPOSITO" ? "minorista" : "mayorista";
}

function priceTypeLabel(priceType?: CartItem["priceType"] | null) {
  return priceType === WHOLESALE_PRICE_TYPE ? "Mayorista" : "Minorista";
}

function priceTypeLabelLower(priceType?: CartItem["priceType"] | null) {
  return priceType === WHOLESALE_PRICE_TYPE ? "mayorista" : "minorista";
}

function clientDefaultPriceType(client?: Client | null): CartItem["priceType"] {
  return client?.category === "Mayorista" ? WHOLESALE_PRICE_TYPE : RETAIL_PRICE_TYPE;
}

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function compareText(a?: string | null, b?: string | null) {
  return String(a ?? "").localeCompare(String(b ?? ""), "es", {
    numeric: true,
    sensitivity: "base",
  });
}

function isDeliveryProduct(product?: Product | null) {
  if (!product) return false;
  return normalizeText(product.sku) === DELIVERY_SKU;
}

function getProductImageUrl(product?: Product | null) {
  if (!product) return null;
  const imageUrl = (product as Product & { imageUrl?: string | null }).imageUrl;
  return imageUrl?.trim() || null;
}

type ProductComponentForPOS = {
  id?: string;
  componentId?: string | null;
  quantity?: number | null;
  quantityKg?: number | null;
  component?: Product | null;
};

type ProductWithComponents = Product & {
  components?: ProductComponentForPOS[] | null;
};

function isCompositeProduct(product?: Product | null) {
  return product?.type === "COMPUESTO";
}

function getCompositeComponents(product?: Product | null) {
  return ((product as ProductWithComponents | null)?.components ?? []).filter(
    (component) => component?.component,
  );
}

function isStockControlledProduct(product?: Product | null) {
  if (!product) return false;
  if (isDeliveryProduct(product)) return false;
  if (product.isService) return false;
  return true;
}

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string; error?: string } } })
      ?.response?.data?.message ??
    (error as { response?: { data?: { message?: string; error?: string } } })
      ?.response?.data?.error ??
    fallback
  );
}

function productRawStockByLocation(product: Product, stockLocation: StockLocation) {
  if (product.saleUnit === "KG") {
    return stockLocation === "DEPOSITO"
      ? num(product.stockDepositoKg)
      : num(product.stockLocalKg);
  }

  return stockLocation === "DEPOSITO"
    ? num(product.stockDeposito)
    : num(product.stockLocal);
}

function getComponentNeededQty(componentRelation: ProductComponentForPOS) {
  const componentProduct = componentRelation.component;
  if (!componentProduct) return 0;

  if (componentProduct.saleUnit === "KG") {
    return num(
      componentRelation.quantityKg ?? undefined,
      componentRelation.quantity ?? undefined,
    );
  }

  return num(
    componentRelation.quantity ?? undefined,
    componentRelation.quantityKg ?? undefined,
  );
}

function productStockByLocation(product: Product, stockLocation: StockLocation) {
  if (isDeliveryProduct(product)) return 999999;
  if (product.isService) return 999999;

  if (isCompositeProduct(product)) {
    const components = getCompositeComponents(product);
    if (!components.length) return 0;

    const availableByComponent = components.map((componentRelation) => {
      const componentProduct = componentRelation.component;
      if (!componentProduct) return 0;

      const neededQty = getComponentNeededQty(componentRelation);
      if (neededQty <= 0) return 0;

      const componentStock = productRawStockByLocation(
        componentProduct,
        stockLocation,
      );

      return Math.floor(componentStock / neededQty);
    });

    return Math.max(0, Math.min(...availableByComponent));
  }

  return productRawStockByLocation(product, stockLocation);
}

function stockLabel(product: Product, stockLocation: StockLocation) {
  if (isDeliveryProduct(product)) return "envío / servicio";
  if (product.isService) return "servicio";

  if (isCompositeProduct(product)) {
    const availablePromos = productStockByLocation(product, stockLocation);
    return `${availablePromos} promo${availablePromos === 1 ? "" : "s"}`;
  }

  const stock = productStockByLocation(product, stockLocation);
  return product.saleUnit === "KG" ? `${stock} kg` : `${stock}`;
}

function getItemPrice(item: CartItem, selectedPriceType: CartItem["priceType"]) {
  return num(
    item.manualPrice,
    productPrice(item.product, item.priceType || selectedPriceType),
  );
}

function cartLineKey(item: CartItem) {
  if (item.isDeliveryItem || isDeliveryProduct(item.product)) {
    return `${item.product.id}-delivery`;
  }

  return `${item.product.id}-${item.priceType || RETAIL_PRICE_TYPE}`;
}

function mergeSimilarCartItems(items: CartItem[]) {
  const map = new Map<string, CartItem>();

  for (const item of items) {
    const key = cartLineKey(item);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, item);
      continue;
    }

    if (item.product.saleUnit === "KG") {
      map.set(key, {
        ...existing,
        quantityKg: num(existing.quantityKg) + num(item.quantityKg),
      });
    } else {
      map.set(key, {
        ...existing,
        quantity: existing.quantity + item.quantity,
      });
    }
  }

  return Array.from(map.values());
}

function clientHasCoordinates(client?: Client | null) {
  return (
    client?.latitude !== null &&
    client?.latitude !== undefined &&
    client?.longitude !== null &&
    client?.longitude !== undefined
  );
}

function locationHasCoordinates(location?: BusinessLocation | null) {
  return (
    location?.latitude !== null &&
    location?.latitude !== undefined &&
    location?.longitude !== null &&
    location?.longitude !== undefined
  );
}

function buildClientAddress(client?: Client | null) {
  if (!client) return "";

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

function clientCategoryLabel(category?: string | null) {
  if (category === "Mayorista") return "Mayorista";
  return "Minorista";
}

function deliverySourceLabel(source?: DeliveryCalculation["source"] | null) {
  if (source === "GOOGLE_ROUTES") return "Google Routes";
  if (source === "COORDINATES_FALLBACK") return "Estimado";
  return "Calculado";
}

function formatDurationMinutes(minutes?: number | null) {
  const value = num(minutes);
  if (value <= 0) return "";
  if (value < 60) return `${Math.round(value)} min`;

  const hours = Math.floor(value / 60);
  const remainingMinutes = Math.round(value % 60);
  return `${hours} h${remainingMinutes ? ` ${remainingMinutes} min` : ""}`;
}

function cartItemCounterLabel(item?: CartItem | null) {
  if (!item) return "";

  if (item.product.saleUnit === "KG") {
    const kg = num(item.quantityKg);
    return `${kg.toLocaleString("es-AR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    })} kg`;
  }

  return String(item.quantity);
}

async function fetchPosData() {
  const [p, c, cl, bl] = await Promise.all([
    api.get("/products"),
    api.get("/categories"),
    api.get("/clients"),
    api.get("/business-locations"),
  ]);

  const products = normalizeArray<Product>(p.data).filter((x) => x.isActive !== false);
  const categories = normalizeArray<ProductCategory>(c.data);
  const clients = normalizeArray<Client>(cl.data);
  const businessLocations = normalizeArray<BusinessLocation>(bl.data);

  return { products, categories, clients, businessLocations };
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [businessLocations, setBusinessLocations] = useState<BusinessLocation[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [sortMode, setSortMode] = useState<ProductSortMode>("name-asc");
  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientSuggestionsOpen, setClientSuggestionsOpen] = useState(false);
  const [stockLocation, setStockLocation] = useState<StockLocation>("LOCAL");

  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("PICKUP");
  const [businessLocationId, setBusinessLocationId] = useState("");
  const [deliveryPricePerKm, setDeliveryPricePerKm] = useState("618");
  const [deliveryCalculation, setDeliveryCalculation] = useState<DeliveryCalculation | null>(null);
  const [calculatingDelivery, setCalculatingDelivery] = useState(false);

  const receiptType: ReceiptType = "TICKET";
  const [defaultPriceType, setDefaultPriceType] = useState<CartItem["priceType"]>(RETAIL_PRICE_TYPE);
  const { user: me } = useAuthStore();
  const appliedOwnPreferencesRef = useRef(false);
  const [discountType, setDiscountType] = useState<DiscountType | "">("");
  const [discountValue, setDiscountValue] = useState("");

  const [paymentMode, setPaymentMode] = useState<"single" | "multi">("single");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("EFECTIVO");
  const [payments, setPayments] = useState<SalePayment[]>([
    { method: "EFECTIVO", amount: 0 },
  ]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [pendingProductAdd, setPendingProductAdd] = useState<PendingProductAdd>(null);
  const [clientGateMode, setClientGateMode] = useState<ClientGateMode>(null);
  const [consumerFinalConfirmed, setConsumerFinalConfirmed] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(36);
  const [mounted, setMounted] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);

  const [skuScannerOpen, setSkuScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [scannerLoading, setScannerLoading] = useState(false);
  const scannerInstanceRef = useRef<any>(null);
  const scannerHandledRef = useRef(false);

  useEffect(() => {
    setMounted(true);

    const media = window.matchMedia("(max-width: 767px)");
    const syncMobileView = () => setIsMobileView(media.matches);

    syncMobileView();
    media.addEventListener("change", syncMobileView);

    return () => media.removeEventListener("change", syncMobileView);
  }, []);

  useEffect(() => {
    if (appliedOwnPreferencesRef.current || !me) return;
    appliedOwnPreferencesRef.current = true;

    if (me.defaultStockLocation === "LOCAL" || me.defaultStockLocation === "DEPOSITO") {
      setStockLocation(me.defaultStockLocation);
    }

    if (me.defaultPriceCategory === RETAIL_PRICE_TYPE || me.defaultPriceCategory === WHOLESALE_PRICE_TYPE) {
      setDefaultPriceType(me.defaultPriceCategory as CartItem["priceType"]);
    }
  }, [me]);

  const saveOwnPreferences = async () => {
    try {
      await api.put("/users/me/preferences", {
        defaultStockLocation: stockLocation,
        defaultPriceCategory: defaultPriceType,
      });
      toast.success("Guardado como predeterminado para tu usuario");
    } catch (error) {
      toast.error("No se pudo guardar la preferencia");
    }
  };

  const load = async (showSuccess = false) => {
    setLoading(true);

    try {
      const data = await fetchPosData();

      setProducts(data.products);
      setCategories(data.categories);
      setClients(data.clients);
      setBusinessLocations(data.businessLocations);

      const defaultLocation =
        data.businessLocations.find((x) => x.isDefault) ?? data.businessLocations[0];

      if (defaultLocation) {
        setBusinessLocationId((prev) => prev || defaultLocation.id);
      }

      if (showSuccess) toast.success("POS actualizado correctamente");
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar datos del POS");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    fetchPosData()
      .then((data) => {
        if (!alive) return;

        setProducts(data.products);
        setCategories(data.categories);
        setClients(data.clients);
        setBusinessLocations(data.businessLocations);

        const defaultLocation =
          data.businessLocations.find((x) => x.isDefault) ?? data.businessLocations[0];

        if (defaultLocation) setBusinessLocationId((prev) => prev || defaultLocation.id);
      })
      .catch((e) => {
        console.error(e);
        if (alive) toast.error("Error al cargar datos del POS");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!cart.length && !clientId && !clientGateMode) {
      setConsumerFinalConfirmed(false);
    }
  }, [cart.length, clientId, clientGateMode]);

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;
  const selectedBusinessLocation =
    businessLocations.find((location) => location.id === businessLocationId) ?? null;

  const filteredClients = useMemo(() => {
    const q = normalizeText(clientSearch);

    const result = clients.filter((client) => {
      if (!q) return true;

      const haystack = normalizeText([
        client.nombre,
        client.apellido,
        client.dni,
        client.gmail,
        client.telefono,
      ].filter(Boolean).join(" "));

      return haystack.includes(q);
    });

    return result.slice(0, 80);
  }, [clients, clientSearch]);

  const filteredCategories = useMemo(() => {
    const q = normalizeText(categorySearch);

    if (!q) return categories;

    return categories.filter((category) =>
      normalizeText(category.name).includes(q),
    );
  }, [categories, categorySearch]);

  const deliveryProduct = useMemo(
    () => products.find((p) => isDeliveryProduct(p)),
    [products],
  );

  const activeDefaultPriceType = defaultPriceType || RETAIL_PRICE_TYPE;

  const applyPriceTypeToCart = (nextPriceType: CartItem["priceType"]) => {
    setDefaultPriceType(nextPriceType);
    setCart((prev) =>
      mergeSimilarCartItems(
        prev.map((item) =>
          item.isDeliveryItem || isDeliveryProduct(item.product) || item.product.isService
            ? item
            : { ...item, priceType: nextPriceType },
        ),
      ),
    );
  };

  const setItemPriceType = (lineKey: string, nextPriceType: CartItem["priceType"]) => {
    setCart((prev) =>
      mergeSimilarCartItems(
        prev.map((item) =>
          cartLineKey(item) === lineKey ? { ...item, priceType: nextPriceType } : item,
        ),
      ),
    );
  };

  const closeClientGate = () => {
    setPendingProductAdd(null);
    setClientGateMode(null);
  };

  const continuePendingAddAsConsumerFinal = () => {
    if (!pendingProductAdd) return;

    const pending = pendingProductAdd;
    setConsumerFinalConfirmed(true);
    setClientId("");
    setClientSearch("");
    setClientSuggestionsOpen(false);
    setDefaultPriceType(RETAIL_PRICE_TYPE);
    closeClientGate();
    addProductDirect(pending.product, pending.priceType);
  };

  const openPendingClientPicker = () => {
    setClientGateMode("picker");
    setClientSearch("");
    setClientSuggestionsOpen(false);
  };

  const handleClientChange = (nextClientId: string) => {
    const nextClient = clients.find((client) => client.id === nextClientId) ?? null;
    const nextPriceType = clientDefaultPriceType(nextClient);
    const pending = pendingProductAdd;
    const isPickingClientForPendingProduct = Boolean(pending && clientGateMode === "picker");

    setClientId(nextClientId);
    setClientSearch(nextClient ? clientName(nextClient) : "");
    setClientSuggestionsOpen(false);
    setDeliveryCalculation(null);
    if (deliveryMode === "LOCAL_DELIVERY") removeDeliveryFromCart();

    if (!nextClient) {
      setDefaultPriceType(RETAIL_PRICE_TYPE);

      if (isPickingClientForPendingProduct && pending) {
        setConsumerFinalConfirmed(true);
        closeClientGate();
        addProductDirect(pending.product, pending.priceType);
      }

      return;
    }

    setConsumerFinalConfirmed(false);

    if (isPickingClientForPendingProduct && pending) {
      setDefaultPriceType(nextPriceType);
      closeClientGate();
      addProductDirect(pending.product, nextPriceType);
      return;
    }

    setConfirmModal({
      title: "Actualizar precios del carrito",
      message: `Cliente ${clientName(nextClient)} es ${clientCategoryLabel(nextClient.category)}. ¿Querés que todos los productos usen precio ${priceTypeLabelLower(nextPriceType)}?`,
      confirmText: `Usar precios ${priceTypeLabelLower(nextPriceType)}`,
      danger: false,
      onConfirm: () => applyPriceTypeToCart(nextPriceType),
    });
  };

  const filtered = useMemo(() => {
    const q = normalizeText(search);

    const result = products.filter((p) => {
      if (p.isService) return false;
      if (isDeliveryProduct(p)) return false;

      const haystack = normalizeText([
        p.name,
        p.sku,
        categoryName(p),
      ].filter(Boolean).join(" "));

      return (
        (!q || haystack.includes(q)) &&
        (!categoryId || p.categoryId === categoryId)
      );
    });

    return [...result].sort((a, b) => {
      if (sortMode === "name-asc") return compareText(a.name, b.name);
      if (sortMode === "name-desc") return compareText(b.name, a.name);

      if (sortMode === "category-asc") {
        const byCategory = compareText(categoryName(a), categoryName(b));
        return byCategory || compareText(a.name, b.name);
      }

      if (sortMode === "category-desc") {
        const byCategory = compareText(categoryName(b), categoryName(a));
        return byCategory || compareText(a.name, b.name);
      }

      return 0;
    });
  }, [products, search, categoryId, sortMode]);

  useEffect(() => {
    setVisibleCount(36);
  }, [search, categoryId, sortMode, stockLocation]);

  const visibleProducts = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  const selectedCategoryName =
    categories.find((category) => category.id === categoryId)?.name ?? "Todos";

  const handleCategoryWheel = (event: WheelEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const canScroll = element.scrollWidth > element.clientWidth;

    if (!canScroll) return;

    const horizontalDelta = Math.abs(event.deltaX) >= Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;

    if (horizontalDelta === 0) return;

    event.preventDefault();
    element.scrollLeft += horizontalDelta;
  };

  const handleCategorySelect = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
  };

  const cartUnits = cart.reduce((acc, item) => {
    if (item.product.saleUnit === "KG") return acc + 1;
    return acc + item.quantity;
  }, 0);

  const cartPreview = cart.slice(0, 3);

  const getCartStockRequirements = (items: CartItem[]) => {
    const requirements = new Map<string, { product: Product; required: number }>();

    const addRequirement = (product: Product, required: number) => {
      if (required <= 0) return;
      const current = requirements.get(product.id);
      requirements.set(product.id, {
        product,
        required: (current?.required ?? 0) + required,
      });
    };

    for (const item of items) {
      if (item.isDeliveryItem || isDeliveryProduct(item.product) || item.product.isService) continue;

      const itemQty = item.product.saleUnit === "KG" ? num(item.quantityKg) : item.quantity;
      if (itemQty <= 0) continue;

      if (isCompositeProduct(item.product)) {
        const components = getCompositeComponents(item.product);

        for (const componentRelation of components) {
          const componentProduct = componentRelation.component;
          if (!componentProduct) continue;

          const neededPerPromo = getComponentNeededQty(componentRelation);
          addRequirement(componentProduct, neededPerPromo * itemQty);
        }

        continue;
      }

      addRequirement(item.product, itemQty);
    }

    return requirements;
  };

  const validateCartStockItems = (items: CartItem[]) => {
    const requirements = getCartStockRequirements(items);

    for (const requirement of requirements.values()) {
      const available = productRawStockByLocation(requirement.product, stockLocation);

      if (requirement.required > available) {
        toast.error(
          `Stock insuficiente para ${requirement.product.name} en ${stockLocationLabelLower(stockLocation)}. Disponible: ${available}${requirement.product.saleUnit === "KG" ? " kg" : ""}`,
        );
        return false;
      }
    }

    return true;
  };

  const buildCartWithProduct = (
    product: Product,
    selectedPriceType: CartItem["priceType"] = activeDefaultPriceType,
  ) => {
    const exists = cart.find(
      (i) =>
        i.product.id === product.id &&
        !i.isDeliveryItem &&
        !isDeliveryProduct(i.product) &&
        (i.priceType || activeDefaultPriceType) === selectedPriceType,
    );

    if (exists) {
      return cart.map((i) => {
        if (cartLineKey(i) !== cartLineKey(exists)) return i;
        if (product.saleUnit === "KG") return i;
        return { ...i, quantity: i.quantity + 1 };
      });
    }

    return [
      ...cart,
      {
        product,
        quantity: product.saleUnit === "KG" ? 0 : 1,
        quantityKg: product.saleUnit === "KG" ? 0.1 : undefined,
        priceType: selectedPriceType,
      },
    ];
  };

  function addProductDirect(
    product: Product,
    selectedPriceType: CartItem["priceType"] = activeDefaultPriceType,
  ) {
    const stock = productStockByLocation(product, stockLocation);

    if (isStockControlledProduct(product) && stock <= 0) {
      toast.error(
        isCompositeProduct(product)
          ? `No se puede agregar la promo porque faltan componentes en ${stockLocationLabelLower(stockLocation)}`
          : stockLocation === "DEPOSITO"
            ? "Sin stock disponible en minorista"
            : "Sin stock disponible en mayorista",
      );
      return;
    }

    const nextCart = buildCartWithProduct(product, selectedPriceType);
    if (!validateCartStockItems(nextCart)) return;
    setCart(nextCart);
  }

  function add(
    product: Product,
    selectedPriceType: CartItem["priceType"] = activeDefaultPriceType,
  ) {
    const shouldAskForClient = !clientId && !consumerFinalConfirmed && cart.length === 0;

    if (shouldAskForClient) {
      setPendingProductAdd({ product, priceType: selectedPriceType });
      setClientGateMode("question");
      return;
    }

    addProductDirect(product, selectedPriceType);
  }

  const stopSkuScanner = async () => {
    const scanner = scannerInstanceRef.current;
    scannerHandledRef.current = false;
    if (!scanner) return;

    try {
      const state = scanner.getState?.();
      if (state === 2) await scanner.stop();
    } catch (e) {
      console.warn("No se pudo detener el scanner POS", e);
    }

    try {
      await scanner.clear?.();
    } catch {
      // html5-qrcode puede tirar error si el contenedor ya fue desmontado.
    }

    scannerInstanceRef.current = null;
  };

  const closeSkuScanner = async () => {
    await stopSkuScanner();
    setScannerError("");
    setScannerLoading(false);
    setSkuScannerOpen(false);
  };

  const openSkuScanner = () => {
    setScannerError("");
    setScannerLoading(true);
    scannerHandledRef.current = false;
    setSkuScannerOpen(true);
  };

  const handleScannedSku = async (rawSku: string) => {
    const sku = rawSku.trim();
    if (!sku || scannerHandledRef.current) return;

    scannerHandledRef.current = true;

    const product = products.find((p) => normalizeText(p.sku) === normalizeText(sku));

    if (!product) {
      scannerHandledRef.current = false;
      setScannerError(`No encontré ningún producto con SKU: ${sku}`);
      return;
    }

    if (product.isService || isDeliveryProduct(product)) {
      scannerHandledRef.current = false;
      setScannerError("Ese SKU pertenece a un servicio/envío y no se agrega desde el scanner.");
      return;
    }

    add(product);
    await closeSkuScanner();
  };

  useEffect(() => {
    if (!skuScannerOpen) return;

    let cancelled = false;

    const startScanner = async () => {
      setScannerLoading(true);
      setScannerError("");

      try {
        if (typeof window === "undefined") return;
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode(POS_SKU_SCANNER_ELEMENT_ID);
        scannerInstanceRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
              return {
                width: Math.max(220, Math.min(size, 340)),
                height: Math.max(120, Math.min(Math.floor(size * 0.55), 220)),
              };
            },
            aspectRatio: 1.777,
          },
          async (decodedText: string) => {
            await handleScannedSku(decodedText);
          },
          () => {
            // Ignoramos lecturas fallidas mientras sigue buscando.
          },
        );

        if (!cancelled) setScannerLoading(false);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setScannerLoading(false);
          setScannerError(
            e?.message?.includes("Permission")
              ? "No se pudo acceder a la cámara. Revisá los permisos del navegador."
              : "No se pudo iniciar la cámara. Probá con HTTPS, otro navegador o buscá el SKU manualmente.",
          );
        }
      }
    };

    const timeoutId = window.setTimeout(startScanner, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      void stopSkuScanner();
    };
  }, [skuScannerOpen, products, stockLocation, cart, activeDefaultPriceType]);

  const setQty = (lineKey: string, value: number) => {
    const nextCart = cart.map((i) => {
      if (cartLineKey(i) !== lineKey) return i;

      if (i.isDeliveryItem || isDeliveryProduct(i.product) || i.product.isService) {
        return { ...i, quantity: 1 };
      }

      return { ...i, quantity: Math.max(1, value) };
    });

    if (!validateCartStockItems(nextCart)) return;
    setCart(nextCart);
  };

  const setKg = (lineKey: string, value: number) => {
    const nextCart = cart.map((i) => {
      if (cartLineKey(i) !== lineKey) return i;
      return { ...i, quantityKg: Math.max(0.001, value) };
    });

    if (!validateCartStockItems(nextCart)) return;
    setCart(nextCart);
  };

  const remove = (lineKey: string) => {
    const removed = cart.find((item) => cartLineKey(item) === lineKey);

    setCart((prev) => prev.filter((i) => cartLineKey(i) !== lineKey));

    if (removed && deliveryProduct?.id === removed.product.id) {
      setDeliveryCalculation(null);
      setDeliveryMode("PICKUP");
    }
  };

  const removeDeliveryFromCart = () => {
    if (!deliveryProduct) return;
    setCart((prev) => prev.filter((i) => i.product.id !== deliveryProduct.id));
    setDeliveryCalculation(null);
  };

  const applyDeliveryToCart = (calculation: DeliveryCalculation) => {
    if (!deliveryProduct) {
      toast.error(`No encontré el producto ${DELIVERY_SKU}. Creá primero el producto ENVÍO / FLETE.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === deliveryProduct.id);

      if (existing) {
        return prev.map((i) =>
          i.product.id === deliveryProduct.id
            ? {
                ...i,
                quantity: 1,
                quantityKg: undefined,
                manualPrice: calculation.deliveryCost,
                priceType: "price",
                isDeliveryItem: true,
              }
            : i,
        );
      }

      return [
        ...prev,
        {
          product: deliveryProduct,
          quantity: 1,
          quantityKg: undefined,
          priceType: "price",
          manualPrice: calculation.deliveryCost,
          isDeliveryItem: true,
        },
      ];
    });
  };

  const calculateDelivery = async () => {
    if (deliveryMode !== "LOCAL_DELIVERY") return;

    if (!clientId || !selectedClient) {
      toast.error("Seleccioná un cliente para calcular el envío");
      return;
    }

    if (!clientHasCoordinates(selectedClient)) {
      toast.error("El cliente seleccionado no tiene coordenadas cargadas");
      return;
    }

    if (!businessLocationId || !selectedBusinessLocation) {
      toast.error("Seleccioná la sucursal o ubicación de salida");
      return;
    }

    if (!locationHasCoordinates(selectedBusinessLocation)) {
      toast.error("La ubicación de salida no tiene coordenadas cargadas");
      return;
    }

    const pricePerKm = num(deliveryPricePerKm);
    if (pricePerKm <= 0) {
      toast.error("El precio por km debe ser mayor a 0");
      return;
    }

    setCalculatingDelivery(true);
    const toastId = toast.loading("Calculando envío...");

    try {
      const response = await api.post("/delivery/calculate", {
        businessLocationId,
        clientId,
        pricePerKm,
      });

      const calculation: DeliveryCalculation = {
        distanceKm: num(response.data.distanceKm),
        pricePerKm: num(response.data.pricePerKm),
        deliveryCost: num(response.data.deliveryCost),
        durationMinutes: response.data.durationMinutes ?? null,
        straightDistanceKm: response.data.straightDistanceKm ?? null,
        source: response.data.source,
        businessLocationId: response.data.businessLocationId,
        businessLocationName: response.data.businessLocationName,
        clientId: response.data.clientId,
        clientName: response.data.clientName,
        originAddress: response.data.originAddress,
        destinationAddress: response.data.destinationAddress,
        deliveryAddressSnapshot: response.data.deliveryAddressSnapshot,
      };

      setDeliveryCalculation(calculation);
      applyDeliveryToCart(calculation);
      toast.success(
        calculation.source === "GOOGLE_ROUTES"
          ? `Envío calculado por ruta real: ${calculation.distanceKm} km · ${fmtMoney(calculation.deliveryCost)}`
          : `Envío estimado: ${calculation.distanceKm} km · ${fmtMoney(calculation.deliveryCost)}`,
        { id: toastId },
      );
    } catch (e) {
      toast.error(getErrorMessage(e, "No se pudo calcular el envío"), { id: toastId });
    } finally {
      setCalculatingDelivery(false);
    }
  };

  const productsSubtotal = cart.reduce((a, item) => {
    if (item.isDeliveryItem || isDeliveryProduct(item.product)) return a;
    const qty = item.product.saleUnit === "KG" ? num(item.quantityKg) : item.quantity;
    return a + getItemPrice(item, activeDefaultPriceType) * qty;
  }, 0);

  const deliveryLineSubtotal = cart.reduce((a, item) => {
    if (!item.isDeliveryItem && !isDeliveryProduct(item.product)) return a;
    return a + num(item.manualPrice, getItemPrice(item, activeDefaultPriceType));
  }, 0);

  const deliveryCostForTotal =
    deliveryMode === "LOCAL_DELIVERY"
      ? Math.max(num(deliveryCalculation?.deliveryCost), deliveryLineSubtotal)
      : 0;

  const subtotal = productsSubtotal;
  const discount =
    discountType === "PERCENTAGE"
      ? productsSubtotal * (num(discountValue) / 100)
      : discountType === "FIXED"
        ? num(discountValue)
        : 0;

  const total = Math.max(0, productsSubtotal - discount + deliveryCostForTotal);
  const paid =
    paymentMode === "multi"
      ? payments.filter((p) => p.method !== "CUENTA_CORRIENTE").reduce((a, p) => a + num(p.amount), 0)
      : paymentMethod === "CUENTA_CORRIENTE"
        ? 0
        : total;
  const debt = Math.max(0, total - paid);

  const validateCartStock = () => {
    for (const item of cart) {
      if (item.isDeliveryItem || isDeliveryProduct(item.product) || item.product.isService) continue;

      const qty = item.product.saleUnit === "KG" ? num(item.quantityKg) : item.quantity;

      if (qty <= 0) {
        toast.error(`Cantidad inválida para ${item.product.name}`);
        return false;
      }

      if (isCompositeProduct(item.product) && !getCompositeComponents(item.product).length) {
        toast.error(`La promo ${item.product.name} no tiene componentes configurados`);
        return false;
      }
    }

    return validateCartStockItems(cart);
  };

  const validateSale = () => {
    if (!cart.length) {
      toast.error("Agregá productos al carrito");
      return false;
    }

    if (!validateCartStock()) return false;

    if ((paymentMethod === "CUENTA_CORRIENTE" || debt > 0) && !clientId) {
      toast.error("Para cuenta corriente o pago parcial tenés que seleccionar cliente");
      return false;
    }

    if (deliveryMode === "LOCAL_DELIVERY") {
      if (!clientId) {
        toast.error("Para envío tenés que seleccionar cliente");
        return false;
      }

      if (!businessLocationId) {
        toast.error("Seleccioná la sucursal o ubicación de salida");
        return false;
      }

      if (!deliveryCalculation) {
        toast.error("Calculá el envío antes de finalizar la venta");
        return false;
      }

      if (!deliveryProduct) {
        toast.error(`No encontré el producto ${DELIVERY_SKU}`);
        return false;
      }

      if (deliveryCostForTotal <= 0) {
        toast.error("El costo de envío debe ser mayor a 0");
        return false;
      }
    }

    return true;
  };

  const submitSale = async () => {
    if (!validateSale()) return;

    setSubmitting(true);
    const toastId = toast.loading("Registrando venta...");

    try {
      const payload = {
        clientId: clientId || undefined,
        stockLocation,
        paymentMethod,
        receiptType,
        discountType: discountType || undefined,
        discountValue: discountType ? num(discountValue) : undefined,
        businessLocationId:
          deliveryMode === "LOCAL_DELIVERY" ? businessLocationId : businessLocationId || null,
        deliveryMethod: deliveryMode,
        deliveryStatus: deliveryMode === "LOCAL_DELIVERY" ? "PENDING" : "NONE",
        deliveryAddressSnapshot:
          deliveryMode === "LOCAL_DELIVERY"
            ? deliveryCalculation?.deliveryAddressSnapshot ||
              deliveryCalculation?.destinationAddress ||
              buildClientAddress(selectedClient)
            : null,
        deliveryDistanceKm: deliveryMode === "LOCAL_DELIVERY" ? deliveryCalculation?.distanceKm : null,
        deliveryPricePerKm: deliveryMode === "LOCAL_DELIVERY" ? num(deliveryPricePerKm) : null,
        deliveryCost: deliveryMode === "LOCAL_DELIVERY" ? deliveryCostForTotal : 0,
        items: [
          ...cart
            .filter((i) => !i.isDeliveryItem && !isDeliveryProduct(i.product))
            .map((i) => ({
              productId: i.product.id,
              quantity: i.product.saleUnit === "KG" ? undefined : i.quantity,
              quantityKg: i.product.saleUnit === "KG" ? num(i.quantityKg) : undefined,
              price: getItemPrice(i, activeDefaultPriceType),
              priceType: i.priceType || activeDefaultPriceType,
            })),
          ...(deliveryMode === "LOCAL_DELIVERY" && deliveryProduct && deliveryCostForTotal > 0
            ? [
                {
                  productId: deliveryProduct.id,
                  quantity: 1,
                  quantityKg: undefined,
                  price: deliveryCostForTotal,
                  priceType: "manual",
                },
              ]
            : []),
        ],
        payments:
          paymentMode === "multi"
            ? payments
                .filter((p) => p.amount > 0 || p.method === "CUENTA_CORRIENTE")
                .map((p) => ({
                  method: p.method,
                  amount: p.method === "CUENTA_CORRIENTE" ? debt : num(p.amount),
                  reference: p.reference,
                  notes: p.notes,
                }))
            : undefined,
      };

      console.log("🧾 Payload venta POS:", payload);
      await api.post("/sales", payload);

      setCart([]);
      setPayments([{ method: "EFECTIVO", amount: 0 }]);
      setDeliveryMode("PICKUP");
      setDeliveryCalculation(null);
      setPendingProductAdd(null);
      setClientGateMode(null);
      setConsumerFinalConfirmed(false);

      toast.success("Venta registrada correctamente", { id: toastId });
      await load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Error al registrar venta"), { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const openSubmitConfirm = () => {
    if (!validateSale()) return;

    setConfirmModal({
      title: "Finalizar venta",
      message: `¿Confirmás registrar esta venta por ${fmtMoney(total)}?${debt > 0 ? ` Quedará en cuenta corriente: ${fmtMoney(debt)}.` : ""}`,
      confirmText: "Finalizar venta",
      danger: false,
      onConfirm: submitSale,
    });
  };

  const confirmAction = async () => {
    if (!confirmModal) return;

    setConfirmLoading(true);

    try {
      await confirmModal.onConfirm();
      setConfirmModal(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  const addPayment = () => {
    setPayments((prev) => [...prev, { method: "TRANSFERENCIA", amount: 0 }]);
  };

  const renderPricePresetSelector = (compact = false) => (
    <section className={compact ? "pos-pre-price-bar compact" : "pos-pre-price-bar"}>
      <div className="pos-pre-price-copy">
        <b>Precio para agregar productos</b>
        <span>Elegí antes de cargar: los nuevos productos entran como {priceTypeLabel(activeDefaultPriceType)}.</span>
      </div>
      <div className="pos-pre-price-actions">
        <button
          type="button"
          className={activeDefaultPriceType === RETAIL_PRICE_TYPE ? "active" : ""}
          onClick={() => applyPriceTypeToCart(RETAIL_PRICE_TYPE)}
        >
          Minorista
        </button>
        <button
          type="button"
          className={activeDefaultPriceType === WHOLESALE_PRICE_TYPE ? "active" : ""}
          onClick={() => applyPriceTypeToCart(WHOLESALE_PRICE_TYPE)}
        >
          Mayorista
        </button>
      </div>
    </section>
  );

  const renderClientPicker = (compact = false) => {
    const shouldShowSuggestions = clientSuggestionsOpen && clientSearch.trim().length > 0;

    return (
      <div className={compact ? "pos-client-picker compact" : "pos-client-picker"}>
        <label className="form-label">Cliente</label>
        <div className="pos-client-search-wrap">
          <div className="pos-client-search">
            <Search size={14} />
            <input
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setClientSuggestionsOpen(true);
              }}
              onFocus={() => {
                if (clientSearch.trim()) setClientSuggestionsOpen(true);
              }}
              placeholder="Buscar cliente por nombre, DNI, mail o teléfono..."
            />
            {(clientId || clientSearch) && (
              <button
                type="button"
                onClick={() => {
                  handleClientChange("");
                  setClientSuggestionsOpen(false);
                }}
                aria-label="Limpiar cliente"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {shouldShowSuggestions && (
            <div className="pos-client-suggestions">
              <button
                type="button"
                className={!clientId ? "active" : ""}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleClientChange("")}
              >
                <b>Consumidor final</b>
                <span>Sin cliente registrado</span>
              </button>

              {filteredClients.length ? (
                filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    className={clientId === client.id ? "active" : ""}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleClientChange(client.id)}
                  >
                    <b>{clientName(client)}</b>
                    <span>{clientCategoryLabel(client.category)} · DNI {client.dni || "-"} · deuda {fmtMoney(client.currentBalance)}</span>
                  </button>
                ))
              ) : (
                <div className="pos-client-no-results">No encontré clientes con esa búsqueda</div>
              )}
            </div>
          )}
        </div>

        {selectedClient ? (
          <small className="pos-client-help">Seleccionado: {clientName(selectedClient)} · {clientCategoryLabel(selectedClient.category)}</small>
        ) : (
          <small className="pos-client-help">Consumidor final</small>
        )}
      </div>
    );
  };

  const productCartQtyByPrice = (product: Product, priceTypeToCount: CartItem["priceType"]) => {
    return cart.reduce((acc, item) => {
      if (item.product.id !== product.id || item.isDeliveryItem || isDeliveryProduct(item.product)) return acc;
      if ((item.priceType || RETAIL_PRICE_TYPE) !== priceTypeToCount) return acc;

      if (item.product.saleUnit === "KG") return acc + num(item.quantityKg);
      return acc + item.quantity;
    }, 0);
  };

  const formatProductCartQty = (product: Product, qty: number) => {
    if (product.saleUnit === "KG") {
      return `${qty.toLocaleString("es-AR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      })} kg`;
    }

    return String(qty);
  };

  const renderProductPrices = (product: Product, compact = false, disabled = false) => {
    return (
    <div className={compact ? "pos-price-dual compact" : "pos-price-dual"}>
      <button
        type="button"
        className={activeDefaultPriceType === RETAIL_PRICE_TYPE ? "active" : ""}
        onClick={() => add(product, RETAIL_PRICE_TYPE)}
        disabled={disabled}
        title="Agregar con precio minorista"
      >
        <small>Minorista</small>
        <b>{fmtMoney(productPrice(product, RETAIL_PRICE_TYPE))}{product.saleUnit === "KG" ? "/kg" : ""}</b>
      </button>
      <button
        type="button"
        className={activeDefaultPriceType === WHOLESALE_PRICE_TYPE ? "active" : ""}
        onClick={() => add(product, WHOLESALE_PRICE_TYPE)}
        disabled={disabled}
        title="Agregar con precio mayorista"
      >
        <small>Mayorista</small>
        <b>{fmtMoney(productPrice(product, WHOLESALE_PRICE_TYPE))}{product.saleUnit === "KG" ? "/kg" : ""}</b>
      </button>
    </div>
    );
  };

  const renderProductCard = (product: Product, mobile = false) => {
    const stock = productStockByLocation(product, stockLocation);
    const withoutStock = isStockControlledProduct(product) && stock <= 0;
    const imageUrl = getProductImageUrl(product);
    const productCartItems = cart.filter((item) => item.product.id === product.id && !item.isDeliveryItem);
    const cartQty = productCartItems.reduce((acc, item) => {
      if (item.product.saleUnit === "KG") return acc + num(item.quantityKg);
      return acc + item.quantity;
    }, 0);
    const cartQtyLabel = product.saleUnit === "KG"
      ? `${cartQty.toLocaleString("es-AR", { maximumFractionDigits: 3 })} kg`
      : String(cartQty);
    const retailCartQty = productCartQtyByPrice(product, RETAIL_PRICE_TYPE);
    const wholesaleCartQty = productCartQtyByPrice(product, WHOLESALE_PRICE_TYPE);

    return (
      <article
        key={product.id}
        className={mobile ? `pos-product ${withoutStock ? "disabled" : ""}` : `card pos-product-card ${withoutStock ? "disabled" : ""}`}
      >
        <span className={mobile ? "pos-product-img" : "pos-product-image"}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <Package size={mobile ? 24 : 28} />
          )}
          {cartQty > 0 && <span className="pos-added-pill">x{cartQtyLabel}</span>}
        </span>

        {mobile ? (
          <span className="pos-product-info">
            <span className="pos-product-top">
              <span className={product.type === "COMPUESTO" ? "promo" : ""}>
                {product.type === "COMPUESTO" ? "PROMO" : product.saleUnit}
              </span>
              <span className={withoutStock ? "danger" : ""}>
                {withoutStock ? "Sin stock" : stockLabel(product, stockLocation)}
              </span>
            </span>
            <strong>{product.name}</strong>
            <small>{product.sku ?? "SIN-SKU"}</small>
            {renderProductPrices(product, true, withoutStock)}
            {cartQty > 0 && (
              <span className="pos-card-cart-breakdown compact">
                <b>En carrito:</b>
                {wholesaleCartQty > 0 && <span>{formatProductCartQty(product, wholesaleCartQty)}x P. Mayorista</span>}
                {retailCartQty > 0 && <span>{formatProductCartQty(product, retailCartQty)}x P. Minorista</span>}
              </span>
            )}
          </span>
        ) : (
          <>
            <div className="pos-product-meta">
              <span className={`badge ${product.type === "COMPUESTO" ? "badge-blue" : "badge-gray"}`}>
                {product.type === "COMPUESTO" ? "PROMO" : product.saleUnit}
              </span>
              <span className={withoutStock ? "danger" : "muted"}>
                {withoutStock ? "SIN STOCK" : stockLabel(product, stockLocation)}
              </span>
            </div>
            <b className="pos-product-title">{product.name}</b>
            <span className="muted small">{categoryName(product)} · {product.sku ?? "SIN-SKU"}</span>
            {renderProductPrices(product, false, withoutStock)}
            {cartQty > 0 && (
              <div className="pos-card-cart-breakdown">
                <b>En carrito:</b>
                {wholesaleCartQty > 0 && <span>{formatProductCartQty(product, wholesaleCartQty)}x P. Mayorista</span>}
                {retailCartQty > 0 && <span>{formatProductCartQty(product, retailCartQty)}x P. Minorista</span>}
              </div>
            )}
            <span className={withoutStock ? "danger small" : "muted small"}>
              Stock {stockLocationLabelLower(stockLocation)}: {stockLabel(product, stockLocation)}
            </span>
            <span className="muted small">Tocá un precio para agregarlo</span>
          </>
        )}
      </article>
    );
  };

  const renderCartItem = (item: CartItem, compact = false, reactKey?: string) => {
    const lineKey = cartLineKey(item);
    const itemReactKey = reactKey ?? lineKey;
    const itemPrice = getItemPrice(item, activeDefaultPriceType);
    const imageUrl = getProductImageUrl(item.product);
    const qty = item.product.saleUnit === "KG" ? num(item.quantityKg) : item.quantity;
    const lineTotal = itemPrice * qty;

    return (
      <article key={itemReactKey} className={compact ? "pos-cart-item" : "pos-cart-row"}>
        <div className="pos-cart-item-img">
          {imageUrl ? (
            <img src={imageUrl} alt={item.product.name} loading="lazy" />
          ) : (
            <Package size={18} />
          )}
        </div>

        <div className="pos-cart-item-main">
          <div className="pos-cart-item-title">
            <strong>{item.product.name}{item.isDeliveryItem ? " 🚚" : ""}</strong>
            <button type="button" onClick={() => remove(lineKey)}>
              <Trash2 size={14} />
            </button>
          </div>

          <div className="pos-cart-item-meta">
            <span>{fmtMoney(itemPrice)}{item.product.saleUnit === "KG" ? "/kg" : ""}</span>
            <span>Precio {priceTypeLabel(item.priceType || activeDefaultPriceType)}</span>
            {isCompositeProduct(item.product) && <span>Promo: descuenta componentes</span>}
            {!isCompositeProduct(item.product) && !isStockControlledProduct(item.product) && (
              <span>{isDeliveryProduct(item.product) ? "Envío / servicio" : "Servicio sin stock"}</span>
            )}
          </div>

          {!item.isDeliveryItem && !isDeliveryProduct(item.product) && !item.product.isService && (
            <div className="pos-item-price-switch">
              <button
                type="button"
                className={(item.priceType || activeDefaultPriceType) === RETAIL_PRICE_TYPE ? "active" : ""}
                onClick={() => setItemPriceType(lineKey, RETAIL_PRICE_TYPE)}
              >
                Minorista · {fmtMoney(productPrice(item.product, RETAIL_PRICE_TYPE))}{item.product.saleUnit === "KG" ? "/kg" : ""}
              </button>
              <button
                type="button"
                className={(item.priceType || activeDefaultPriceType) === WHOLESALE_PRICE_TYPE ? "active" : ""}
                onClick={() => setItemPriceType(lineKey, WHOLESALE_PRICE_TYPE)}
              >
                Mayorista · {fmtMoney(productPrice(item.product, WHOLESALE_PRICE_TYPE))}{item.product.saleUnit === "KG" ? "/kg" : ""}
              </button>
            </div>
          )}

          <div className="pos-cart-item-actions">
            {item.product.saleUnit === "KG" && !item.isDeliveryItem && !isDeliveryProduct(item.product) && !item.product.isService ? (
              <label className="pos-kg-input">
                <span>Kg</span>
                <input
                  type="number"
                  step="0.001"
                  value={item.quantityKg ?? 0}
                  onChange={(e) => setKg(lineKey, num(e.target.value))}
                />
              </label>
            ) : (
              <div className="pos-stepper">
                <button
                  type="button"
                  onClick={() => setQty(lineKey, item.quantity - 1)}
                  disabled={item.isDeliveryItem || isDeliveryProduct(item.product) || item.product.isService}
                >
                  <Minus size={14} />
                </button>
                <span>{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => setQty(lineKey, item.quantity + 1)}
                  disabled={item.isDeliveryItem || isDeliveryProduct(item.product) || item.product.isService}
                >
                  <Plus size={14} />
                </button>
              </div>
            )}

            <b>{fmtMoney(item.isDeliveryItem ? itemPrice : lineTotal)}</b>
          </div>
        </div>
      </article>
    );
  };

  return (
    <AppLayout title="POS" subtitle="Ventas, promos, envíos, pagos parciales y cuenta corriente">
      <div className="pos-desktop-only">
        <div className="pos-desktop-mobile-shell">


          <section className="pos-product-section pos-product-section-desktop">
          <section className="pos-desktop-mobile-controls pos-product-toolbar-desktop">


            {renderPricePresetSelector(true)}

            <div className="pos-desktop-control-grid">
              <label>
                <span>Stock</span>
                <select value={stockLocation} onChange={(e) => setStockLocation(e.target.value as StockLocation)}>
                  <option value="LOCAL">Mayorista</option>
                  <option value="DEPOSITO">Minorista</option>
                </select>
              </label>

              <button
                type="button"
                className="pos-save-default-pref"
                onClick={saveOwnPreferences}
                title="Usar el stock y precio actuales como predeterminados para mi usuario"
              >
                <Check size={14} />
                Usar como predeterminado
              </button>

              <div className="pos-mobile-client-field pos-desktop-client-field">
                {renderClientPicker(true)}
              </div>

              <label>
                <span>Orden</span>
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as ProductSortMode)}
                >
                  <option value="name-asc">Nombre A-Z</option>
                  <option value="name-desc">Nombre Z-A</option>
                  <option value="category-asc">Categoría A-Z</option>
                  <option value="category-desc">Categoría Z-A</option>
                </select>
              </label>
            </div>

            <div className="pos-category-tools">
              <div className="pos-category-searchbox">
                <Search size={15} />
                <input
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="Buscar categoría..."
                  autoComplete="off"
                />
                {categorySearch && (
                  <button
                    type="button"
                    onClick={() => setCategorySearch("")}
                    aria-label="Limpiar búsqueda de categoría"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {categoryId && (
                <button
                  type="button"
                  className="pos-category-clear"
                  onClick={() => handleCategorySelect("")}
                >
                  Limpiar categoría
                </button>
              )}
            </div>

            <div
              className="pos-category-strip pos-category-strip-desktop"
              onWheel={handleCategoryWheel}
            >
              <button type="button" className={!categoryId ? "active" : ""} onClick={() => handleCategorySelect("")}>Todos</button>
              {filteredCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={categoryId === category.id ? "active" : ""}
                  onClick={() => handleCategorySelect(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {categorySearch.trim() && !filteredCategories.length && (
              <small className="pos-category-empty">
                No encontré categorías con “{categorySearch.trim()}”.
              </small>
            )}
          </section>

            {loading && <div className="pos-grid pos-desktop-like-grid">{Array.from({ length: 12 }).map((_, index) => <div key={index} className="pos-product-skeleton" />)}</div>}
            {!loading && !filtered.length && <div className="pos-empty"><Package size={34} /><b>No encontré productos</b><span>Probá otra búsqueda o sacá el filtro de categoría.</span></div>}
            {!loading && !!filtered.length && (
              <>
              <div className="pos-searchbox pos-searchbox-desktop">
              <Search size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por producto o SKU..."
                autoComplete="off"
              />
              <button type="button" className="pos-search-scan-btn" onClick={openSkuScanner} aria-label="Escanear SKU" title="Escanear SKU">
                <ScanBarcode size={17} />
              </button>
              {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda"><X size={15} /></button>}
            </div>
            
                <div className="pos-grid pos-desktop-like-grid">
                  {visibleProducts.map((product) => renderProductCard(product, true))}
                </div>
                {visibleProducts.length < filtered.length && (
                  <button type="button" className="pos-load-more" onClick={() => setVisibleCount((prev) => prev + 36)}>
                    Ver más productos · {filtered.length - visibleProducts.length} restantes
                  </button>
                )}
              </>
            )}
          </section>
        </div>

        {mounted && !isMobileView && createPortal(
          <>
            <button type="button" className="pos-cart-fab pos-cart-fab-desktop" onClick={() => setCartOpen(true)}>
              <span className="pos-cart-fab-left">
                <ShoppingCart size={19} />
                <span>
                  <b>Carrito</b>
                  <small>{cart.length ? `${cartUnits} item${cartUnits === 1 ? "" : "s"}` : "Tocar para abrir"}</small>
                </span>
              </span>
              <span className="pos-cart-fab-right">
                <b>{fmtMoney(total)}</b>
                <small>Finalizar venta</small>
              </span>
            </button>

            {cartOpen && (
              <div className="pos-cart-layer pos-cart-layer-desktop">
                <div className="pos-cart-sheet pos-cart-sheet-desktop" role="dialog" aria-modal="true" aria-label="Carrito">
                  <div className="pos-cart-handle" />
                  <header className="pos-cart-header">
                    <div><b>Carrito de venta</b><span>{cart.length} productos · {fmtMoney(total)}</span></div>
                    <button type="button" className="pos-icon-btn" onClick={() => setCartOpen(false)}><X size={18} /></button>
                  </header>

                  <div className="pos-cart-scroll">
                    <div className="pos-mini-summary">
                      <span><Warehouse size={14} />{stockLocationLabel(stockLocation)}</span>
                      <span>Precio {priceTypeLabel(activeDefaultPriceType)}</span>
                      {debt > 0 && <span className="warn">Deuda {fmtMoney(debt)}</span>}
                    </div>

                    <div className="pos-mobile-price-actions">
                      <button
                        type="button"
                        className={activeDefaultPriceType === RETAIL_PRICE_TYPE ? "active" : ""}
                        onClick={() => applyPriceTypeToCart(RETAIL_PRICE_TYPE)}
                      >
                        Todos minoristas
                      </button>
                      <button
                        type="button"
                        className={activeDefaultPriceType === WHOLESALE_PRICE_TYPE ? "active" : ""}
                        onClick={() => applyPriceTypeToCart(WHOLESALE_PRICE_TYPE)}
                      >
                        Todos mayoristas
                      </button>
                    </div>

                    <div className="pos-cart-products pos-cart-products-desktop">
                      {!cart.length && <div className="pos-empty compact"><ShoppingCart size={28} /><b>Carrito vacío</b><span>Tocá productos para agregarlos en segundos.</span></div>}
                      {cart.map((item, index) => renderCartItem(item, true, `${cartLineKey(item)}-${index}`))}
                    </div>

                    <section className="pos-sale-options">
                      <details open>
                        <summary>Entrega / envío</summary>
                        <div className="pos-option-body">
                          <label>
                            <span>Tipo de entrega</span>
                            <select
                              value={deliveryMode}
                              onChange={(e) => {
                                const next = e.target.value as DeliveryMode;
                                setDeliveryMode(next);
                                setDeliveryCalculation(null);
                                if (next === "PICKUP") removeDeliveryFromCart();
                              }}
                            >
                              <option value="PICKUP">Retiro en sucursal</option>
                              <option value="LOCAL_DELIVERY">Envío local</option>
                            </select>
                          </label>
                          <label>
                            <span>Sale desde</span>
                            <select
                              value={businessLocationId}
                              onChange={(e) => {
                                setBusinessLocationId(e.target.value);
                                setDeliveryCalculation(null);
                                if (deliveryMode === "LOCAL_DELIVERY") removeDeliveryFromCart();
                              }}
                            >
                              <option value="">{businessLocations.length ? "Seleccionar" : "Sin ubicaciones"}</option>
                              {businessLocations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.isDefault ? " · default" : ""}</option>)}
                            </select>
                          </label>

                          {deliveryMode === "LOCAL_DELIVERY" && (
                            <>
                              <label>
                                <span>Precio por km</span>
                                <input
                                  type="number"
                                  value={deliveryPricePerKm}
                                  onChange={(e) => {
                                    setDeliveryPricePerKm(e.target.value);
                                    setDeliveryCalculation(null);
                                    removeDeliveryFromCart();
                                  }}
                                  placeholder="Ej: 8000"
                                />
                              </label>
                              {selectedClient && <small className={clientHasCoordinates(selectedClient) ? "pos-help" : "pos-help danger"}>{clientHasCoordinates(selectedClient) ? buildClientAddress(selectedClient) || "Cliente con coordenadas" : "Este cliente no tiene coordenadas cargadas"}</small>}
                              <button type="button" className="pos-secondary-action" onClick={calculateDelivery} disabled={calculatingDelivery || !clientId || !businessLocationId}>
                                <Truck size={15} />{calculatingDelivery ? "Calculando..." : "Calcular envío"}
                              </button>
                              {deliveryCalculation && (
                                <div className={deliveryCalculation.source === "COORDINATES_FALLBACK" ? "pos-delivery-ok fallback" : "pos-delivery-ok"}>
                                  <div className="pos-delivery-ok-head">
                                    <b>Envío: {fmtMoney(deliveryCalculation.deliveryCost)}</b>
                                    <span className={deliveryCalculation.source === "GOOGLE_ROUTES" ? "pos-route-source google" : "pos-route-source fallback"}>
                                      {deliverySourceLabel(deliveryCalculation.source)}
                                    </span>
                                  </div>
                                  <span>Ruta: {deliveryCalculation.distanceKm} km x {fmtMoney(deliveryCalculation.pricePerKm)}</span>
                                  {formatDurationMinutes(deliveryCalculation.durationMinutes) && (
                                    <span>Tiempo estimado: {formatDurationMinutes(deliveryCalculation.durationMinutes)}</span>
                                  )}
                                  {deliveryCalculation.source === "COORDINATES_FALLBACK" && (
                                    <small>Google no respondió. Se usó distancia recta ajustada como cálculo aproximado.</small>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </details>

                      <details open>
                        <summary>Ticket, descuento y pago</summary>
                        <div className="pos-option-body">
                          <div className="pos-ticket-fixed"><Check size={14} /> Siempre se emite ticket</div>
                          <div className="pos-control-grid">
                            <label><span>Descuento</span><select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType | "")}><option value="">Sin descuento</option><option value="PERCENTAGE">%</option><option value="FIXED">$</option></select></label>
                          </div>
                          {discountType && <label><span>Valor descuento</span><input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="Valor" /></label>}
                          <label><span>Modo de pago</span><select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as "single" | "multi")}><option value="single">Un método</option><option value="multi">Múltiples / parcial</option></select></label>
                          {paymentMode === "single" ? (
                            <label><span>Método</span><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>{methods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
                          ) : (
                            <div className="pos-payments">
                              {payments.map((payment, index) => (
                                <div key={index} className="pos-payment-line">
                                  <select value={payment.method} onChange={(e) => setPayments((prev) => prev.map((current, paymentIndex) => paymentIndex === index ? { ...current, method: e.target.value as PaymentMethod } : current))}>{methods.map((method) => <option key={method} value={method}>{method}</option>)}</select>
                                  <input type="number" value={payment.method === "CUENTA_CORRIENTE" ? debt || "" : payment.amount || ""} disabled={payment.method === "CUENTA_CORRIENTE"} onChange={(e) => setPayments((prev) => prev.map((current, paymentIndex) => paymentIndex === index ? { ...current, amount: num(e.target.value) } : current))} />
                                </div>
                              ))}
                              <button type="button" className="pos-secondary-action" onClick={addPayment}><Plus size={14} />Agregar pago</button>
                            </div>
                          )}
                        </div>
                      </details>
                    </section>
                  </div>

                  <footer className="pos-cart-footer">
                    <div className="pos-totals">
                      <div><span>Subtotal</span><b>{fmtMoney(subtotal)}</b></div>
                      {deliveryMode === "LOCAL_DELIVERY" && deliveryCostForTotal > 0 && <div><span>Envío</span><b>{fmtMoney(deliveryCostForTotal)}</b></div>}
                      {discount > 0 && <div><span>Descuento</span><b>-{fmtMoney(discount)}</b></div>}
                      <div className="total"><span>Total</span><b>{fmtMoney(total)}</b></div>
                    </div>
                    {debt > 0 && <div className="badge badge-yellow debt-badge">Queda en cuenta corriente: {fmtMoney(debt)}</div>}
                    <button type="button" className="pos-finish" disabled={submitting || !cart.length} onClick={openSubmitConfirm}>
                      <Check size={18} />{submitting ? "Registrando..." : `Finalizar · ${fmtMoney(total)}`}
                    </button>
                  </footer>
                </div>
              </div>
            )}

            {!cartOpen && cart.length > 0 && (
              <div className="pos-cart-preview pos-cart-preview-desktop" onClick={() => setCartOpen(true)}>
                {cartPreview.map((item, index) => {
                  const imageUrl = getProductImageUrl(item.product);
                  return <span key={`${cartLineKey(item)}-${index}`}>{imageUrl ? <img src={imageUrl} alt={item.product.name} loading="lazy" /> : <Package size={13} />}</span>;
                })}
                {cart.length > cartPreview.length && <b>+{cart.length - cartPreview.length}</b>}
              </div>
            )}
          </>,
          document.body,
        )}
      </div>

      <div className="pos-mobile-only">
        <div className="pos-mobile-shell">
          <section className="pos-hero">
            <div>
              <p className="pos-kicker">Venta rápida</p>
              <p>{filtered.length} productos · {selectedCategoryName} · Stock {stockLocationLabelLower(stockLocation)}</p>
            </div>
            <button className="pos-icon-btn" type="button" onClick={() => load(true)} disabled={loading}>
              <RefreshCcw size={17} />
            </button>
          </section>

          <section className="pos-mobile-controls">
            <div className="pos-searchbox">
              <Search size={17} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por producto o SKU..." autoComplete="off" />
              <button type="button" className="pos-search-scan-btn" onClick={openSkuScanner} aria-label="Escanear SKU">
                <ScanBarcode size={16} />
              </button>
              {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda"><X size={15} /></button>}
            </div>

            {renderPricePresetSelector(true)}

            <div className="pos-control-grid">
              <label>
                <span>Stock</span>
                <select value={stockLocation} onChange={(e) => setStockLocation(e.target.value as StockLocation)}>
                  <option value="LOCAL">Mayorista</option>
                  <option value="DEPOSITO">Minorista</option>
                </select>
              </label>
              <button
                type="button"
                className="pos-save-default-pref"
                onClick={saveOwnPreferences}
                title="Usar el stock y precio actuales como predeterminados para mi usuario"
              >
                <Check size={14} />
                Usar como predeterminado
              </button>

              <div className="pos-mobile-client-field">
                {renderClientPicker(true)}
              </div>

              <label className="pos-sort-mobile-field">
                <span>Orden</span>
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as ProductSortMode)}
                >
                  <option value="name-asc">A-Z</option>
                  <option value="name-desc">Z-A</option>
                  <option value="category-asc">Categoría A-Z</option>
                  <option value="category-desc">Categoría Z-A</option>
                </select>
              </label>
            </div>

            <div
              className="pos-category-strip"
              onWheel={handleCategoryWheel}
            >
              <button type="button" className={!categoryId ? "active" : ""} onClick={() => handleCategorySelect("")}>Todos</button>
              {categories.map((category) => (
                <button key={category.id} type="button" className={categoryId === category.id ? "active" : ""} onClick={() => handleCategorySelect(category.id)}>{category.name}</button>
              ))}
            </div>
          </section>

          <section className="pos-product-section">
            {loading && <div className="pos-grid">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="pos-product-skeleton" />)}</div>}
            {!loading && !filtered.length && <div className="pos-empty"><Package size={34} /><b>No encontré productos</b><span>Probá otra búsqueda o sacá el filtro de categoría.</span></div>}
            {!loading && !!filtered.length && (
              <>
                <div className="pos-grid">{visibleProducts.map((product) => renderProductCard(product, true))}</div>
                {visibleProducts.length < filtered.length && (
                  <button type="button" className="pos-load-more" onClick={() => setVisibleCount((prev) => prev + 36)}>
                    Ver más productos · {filtered.length - visibleProducts.length} restantes
                  </button>
                )}
              </>
            )}
          </section>
        </div>

        {mounted && isMobileView && createPortal(
          <>
            <button type="button" className="pos-cart-fab" onClick={() => setCartOpen(true)}>
              <span className="pos-cart-fab-left"><ShoppingCart size={18} /><span><b>Carrito</b><small>{cart.length ? `${cartUnits} item${cartUnits === 1 ? "" : "s"}` : "Tocar para abrir"}</small></span></span>
              <span className="pos-cart-fab-right"><b>{fmtMoney(total)}</b><small>Finalizar</small></span>
            </button>

            {cartOpen && (
              <div className="pos-cart-layer">
                <div className="pos-cart-sheet" role="dialog" aria-modal="true" aria-label="Carrito">
                  <div className="pos-cart-handle" />
                  <header className="pos-cart-header">
                    <div><b>Carrito de venta</b><span>{cart.length} productos · {fmtMoney(total)}</span></div>
                    <button type="button" className="pos-icon-btn" onClick={() => setCartOpen(false)}><X size={18} /></button>
                  </header>

                  <div className="pos-cart-scroll">
                    <div className="pos-mini-summary">
                      <span><Warehouse size={14} />{stockLocationLabel(stockLocation)}</span>
                      <span>Precio {priceTypeLabel(activeDefaultPriceType)}</span>
                      {debt > 0 && <span className="warn">Deuda {fmtMoney(debt)}</span>}
                    </div>

                    <div className="pos-mobile-price-actions">
                      <button
                        type="button"
                        className={activeDefaultPriceType === RETAIL_PRICE_TYPE ? "active" : ""}
                        onClick={() => applyPriceTypeToCart(RETAIL_PRICE_TYPE)}
                      >
                        Todos minoristas
                      </button>
                      <button
                        type="button"
                        className={activeDefaultPriceType === WHOLESALE_PRICE_TYPE ? "active" : ""}
                        onClick={() => applyPriceTypeToCart(WHOLESALE_PRICE_TYPE)}
                      >
                        Todos mayoristas
                      </button>
                    </div>

                    <div className="pos-cart-products">
                      {!cart.length && <div className="pos-empty compact"><ShoppingCart size={28} /><b>Carrito vacío</b><span>Tocá productos para agregarlos en segundos.</span></div>}
                      {cart.map((item, index) => renderCartItem(item, true, `${cartLineKey(item)}-${index}`))}
                    </div>

                    <section className="pos-sale-options">
                      <details>
                        <summary>Entrega / envío</summary>
                        <div className="pos-option-body">
                          <label>
                            <span>Tipo de entrega</span>
                            <select
                              value={deliveryMode}
                              onChange={(e) => {
                                const next = e.target.value as DeliveryMode;
                                setDeliveryMode(next);
                                setDeliveryCalculation(null);
                                if (next === "PICKUP") removeDeliveryFromCart();
                              }}
                            >
                              <option value="PICKUP">Retiro en sucursal</option>
                              <option value="LOCAL_DELIVERY">Envío local</option>
                            </select>
                          </label>
                          <label>
                            <span>Sale desde</span>
                            <select
                              value={businessLocationId}
                              onChange={(e) => {
                                setBusinessLocationId(e.target.value);
                                setDeliveryCalculation(null);
                                if (deliveryMode === "LOCAL_DELIVERY") removeDeliveryFromCart();
                              }}
                            >
                              <option value="">{businessLocations.length ? "Seleccionar" : "Sin ubicaciones"}</option>
                              {businessLocations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.isDefault ? " · default" : ""}</option>)}
                            </select>
                          </label>

                          {deliveryMode === "LOCAL_DELIVERY" && (
                            <>
                              <label>
                                <span>Precio por km</span>
                                <input
                                  type="number"
                                  value={deliveryPricePerKm}
                                  onChange={(e) => {
                                    setDeliveryPricePerKm(e.target.value);
                                    setDeliveryCalculation(null);
                                    removeDeliveryFromCart();
                                  }}
                                  placeholder="Ej: 8000"
                                />
                              </label>
                              {selectedClient && <small className={clientHasCoordinates(selectedClient) ? "pos-help" : "pos-help danger"}>{clientHasCoordinates(selectedClient) ? buildClientAddress(selectedClient) || "Cliente con coordenadas" : "Este cliente no tiene coordenadas cargadas"}</small>}
                              <button type="button" className="pos-secondary-action" onClick={calculateDelivery} disabled={calculatingDelivery || !clientId || !businessLocationId}>
                                <Truck size={15} />{calculatingDelivery ? "Calculando..." : "Calcular envío"}
                              </button>
                              {deliveryCalculation && (
                                <div className={deliveryCalculation.source === "COORDINATES_FALLBACK" ? "pos-delivery-ok fallback" : "pos-delivery-ok"}>
                                  <div className="pos-delivery-ok-head">
                                    <b>Envío: {fmtMoney(deliveryCalculation.deliveryCost)}</b>
                                    <span className={deliveryCalculation.source === "GOOGLE_ROUTES" ? "pos-route-source google" : "pos-route-source fallback"}>
                                      {deliverySourceLabel(deliveryCalculation.source)}
                                    </span>
                                  </div>
                                  <span>Ruta: {deliveryCalculation.distanceKm} km x {fmtMoney(deliveryCalculation.pricePerKm)}</span>
                                  {formatDurationMinutes(deliveryCalculation.durationMinutes) && (
                                    <span>Tiempo estimado: {formatDurationMinutes(deliveryCalculation.durationMinutes)}</span>
                                  )}
                                  {deliveryCalculation.source === "COORDINATES_FALLBACK" && (
                                    <small>Google no respondió. Se usó distancia recta ajustada como cálculo aproximado.</small>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </details>

                      <details>
                        <summary>Ticket, descuento y pago</summary>
                        <div className="pos-option-body">
                          <div className="pos-ticket-fixed"><Check size={14} /> Siempre se emite ticket</div>
                          <div className="pos-control-grid">
                            <label><span>Descuento</span><select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType | "")}><option value="">Sin descuento</option><option value="PERCENTAGE">%</option><option value="FIXED">$</option></select></label>
                          </div>
                          {discountType && <label><span>Valor descuento</span><input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="Valor" /></label>}
                          <label><span>Modo de pago</span><select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as "single" | "multi")}><option value="single">Un método</option><option value="multi">Múltiples / parcial</option></select></label>
                          {paymentMode === "single" ? (
                            <label><span>Método</span><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>{methods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
                          ) : (
                            <div className="pos-payments">
                              {payments.map((payment, index) => (
                                <div key={index} className="pos-payment-line">
                                  <select value={payment.method} onChange={(e) => setPayments((prev) => prev.map((current, paymentIndex) => paymentIndex === index ? { ...current, method: e.target.value as PaymentMethod } : current))}>{methods.map((method) => <option key={method} value={method}>{method}</option>)}</select>
                                  <input type="number" value={payment.method === "CUENTA_CORRIENTE" ? debt || "" : payment.amount || ""} disabled={payment.method === "CUENTA_CORRIENTE"} onChange={(e) => setPayments((prev) => prev.map((current, paymentIndex) => paymentIndex === index ? { ...current, amount: num(e.target.value) } : current))} />
                                </div>
                              ))}
                              <button type="button" className="pos-secondary-action" onClick={addPayment}><Plus size={14} />Agregar pago</button>
                            </div>
                          )}
                        </div>
                      </details>
                    </section>
                  </div>

                  <footer className="pos-cart-footer">
                    <div className="pos-totals">
                      <div><span>Subtotal</span><b>{fmtMoney(subtotal)}</b></div>
                      {deliveryMode === "LOCAL_DELIVERY" && deliveryCostForTotal > 0 && <div><span>Envío</span><b>{fmtMoney(deliveryCostForTotal)}</b></div>}
                      {discount > 0 && <div><span>Descuento</span><b>-{fmtMoney(discount)}</b></div>}
                      <div className="total"><span>Total</span><b>{fmtMoney(total)}</b></div>
                    </div>
                    <button type="button" className="pos-finish" disabled={submitting || !cart.length} onClick={openSubmitConfirm}>
                      <Check size={18} />{submitting ? "Registrando..." : `Finalizar · ${fmtMoney(total)}`}
                    </button>
                  </footer>
                </div>
              </div>
            )}

            {!cartOpen && cart.length > 0 && (
              <div className="pos-cart-preview" onClick={() => setCartOpen(true)}>
                {cartPreview.map((item, index) => {
                  const imageUrl = getProductImageUrl(item.product);
                  return <span key={`${cartLineKey(item)}-${index}`}>{imageUrl ? <img src={imageUrl} alt={item.product.name} loading="lazy" /> : <Package size={13} />}</span>;
                })}
                {cart.length > cartPreview.length && <b>+{cart.length - cartPreview.length}</b>}
              </div>
            )}
          </>,
          document.body,
        )}
      </div>

      {clientGateMode && pendingProductAdd && mounted && typeof document !== "undefined" &&
        createPortal(
          <div className="modal-overlay client-gate-overlay">
            <div className="modal pos-client-gate-modal">
              <div className="modal-header">
                <b>{clientGateMode === "question" ? "Antes de cargar el producto" : "Seleccionar cliente"}</b>
                <button className="btn btn-ghost btn-sm" onClick={closeClientGate}>
                  <X size={16} />
                </button>
              </div>

              {clientGateMode === "question" ? (
                <>
                  <div className="modal-body pos-client-gate-body">
                    <div className="pos-client-gate-product">
                      <div className="pos-client-gate-product-img">
                        {getProductImageUrl(pendingProductAdd.product) ? (
                          <img
                            src={getProductImageUrl(pendingProductAdd.product) ?? ""}
                            alt={pendingProductAdd.product.name}
                            loading="lazy"
                          />
                        ) : (
                          <Package size={22} />
                        )}
                      </div>
                      <div>
                        <span>Producto seleccionado</span>
                        <b>{pendingProductAdd.product.name}</b>
                        <small>Precio {priceTypeLabel(pendingProductAdd.priceType)}</small>
                      </div>
                    </div>

                    <div className="confirm-box">
                      <span className="info-icon"><AlertTriangle size={18} /></span>
                      <p>
                        No seleccionaste ningún cliente. ¿Querés elegir un cliente ahora o cargar esta venta como consumidor final?
                      </p>
                    </div>
                  </div>

                  <div className="modal-footer pos-client-gate-actions">
                    <button type="button" className="btn btn-secondary" onClick={continuePendingAddAsConsumerFinal}>
                      Consumidor final
                    </button>
                    <button type="button" className="btn btn-primary" onClick={openPendingClientPicker}>
                      Elegir cliente
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="modal-body pos-client-gate-body">
                    <div className="pos-client-gate-help">
                      <b>Buscá y seleccioná un cliente</b>
                      <span>Cuando lo elijas, el producto se agrega automáticamente con el precio de su categoría.</span>
                    </div>

                    {renderClientPicker()}
                  </div>

                  <div className="modal-footer pos-client-gate-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setClientGateMode("question")}>
                      Volver
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={continuePendingAddAsConsumerFinal}>
                      Usar consumidor final
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}

      {skuScannerOpen && mounted && typeof document !== "undefined" &&
        createPortal(
          <div className="modal-overlay scanner-overlay">
            <div className="modal pos-scanner-modal">
              <div className="modal-header">
                <b>Escanear producto</b>
                <button className="btn btn-ghost btn-sm" onClick={closeSkuScanner}><X size={16} /></button>
              </div>
              <div className="modal-body pos-scanner-body">
                <div className="pos-scanner-info">
                  <ScanBarcode size={18} />
                  <div><b>Apuntá al código de barras o QR</b><small>Cuando lo detecte, agrega el producto directo al carrito.</small></div>
                </div>
                <div className="pos-scanner-frame">
                  <div id={POS_SKU_SCANNER_ELEMENT_ID} className="pos-scanner-reader" />
                  {scannerLoading && <div className="pos-scanner-loading"><span className="spinner" /><p>Iniciando cámara...</p></div>}
                </div>
                {scannerError ? <div className="pos-scanner-error"><AlertTriangle size={16} /><span>{scannerError}</span></div> : <p className="pos-scanner-note">Tip: acercá el código, evitá reflejos y usá buena luz.</p>}
              </div>
              <div className="modal-footer pos-confirm-footer"><button className="btn btn-secondary" onClick={closeSkuScanner}>Cancelar</button></div>
            </div>
          </div>,
          document.body,
        )}

      {confirmModal && mounted && typeof document !== "undefined" &&
        createPortal(
          <div className="modal-overlay">
            <div className="modal pos-confirm-modal">
              <div className="modal-header">
                <b>{confirmModal.title}</b>
                <button className="btn btn-ghost btn-sm" onClick={() => !confirmLoading && setConfirmModal(null)} disabled={confirmLoading}><X size={16} /></button>
              </div>
              <div className="modal-body">
                <div className="confirm-box">
                  <span className={confirmModal.danger ? "danger-icon" : "info-icon"}><AlertTriangle size={18} /></span>
                  <p>{confirmModal.message}</p>
                </div>
              </div>
              <div className="modal-footer pos-confirm-footer">
                <button className="btn btn-secondary" onClick={() => setConfirmModal(null)} disabled={confirmLoading}>Cancelar</button>
                <button className={confirmModal.danger ? "btn btn-danger" : "btn btn-primary"} onClick={confirmAction} disabled={confirmLoading}>{confirmLoading ? <span className="spinner" /> : (confirmModal.confirmText ?? "Confirmar")}</button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <style jsx global>{`
/*
  ================================================================
  POS — CSS RESPONSIVE COMPLETO
  Reemplazá el contenido del bloque <style jsx global> con esto.

  Estrategia: mobile-first, breakpoints limpios sin solapamientos.
  xs: 0px | sm: 400px | md: 768px | lg: 1024px | xl: 1280px | 2xl: 1440px
  ================================================================
*/

/* ── Toast siempre encima ── */
div[data-rht-toaster], div[data-rht-toaster] * { z-index: 2147483647 !important; }

/* ── Helpers ── */
.muted  { color: var(--text3); }
.small  { font-size: 11px; }
.danger { color: var(--danger) !important; }
.full   { width: 100%; justify-content: center; }

/* ================================================================
   MODALES — base mobile, se centra en ≥768px
   ================================================================ */
.modal-overlay {
  position: fixed; inset: 0;
  z-index: 2147483600 !important;
  display: flex; align-items: flex-end; justify-content: center;
  padding: 0;
  background: rgba(0,0,0,.52);
  overflow-y: auto;
}
@media (min-width: 768px) {
  .modal-overlay { align-items: center; padding: 20px; }
}

.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 26px 26px 0 0;
  max-height: 94dvh;
  width: 100%;
  overflow: hidden;
  display: flex; flex-direction: column;
}
@media (min-width: 768px) {
  .modal {
    border-radius: 22px;
    width: min(560px, calc(100vw - 40px));
    max-height: calc(100dvh - 40px);
  }
}

.modal-header,
.modal-footer {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center;
  justify-content: space-between; gap: 12px;
}
.modal-footer { border-top: 1px solid var(--border); border-bottom: 0; }
.modal-body   { padding: 16px; overflow-y: auto; flex: 1; }

/* Confirm modal */
.pos-confirm-modal { width: 100%; }
.pos-scanner-modal { width: 100%; }
@media (min-width: 768px) {
  .pos-confirm-modal { width: min(520px, calc(100vw - 40px)); }
  .pos-scanner-modal { width: min(560px, calc(100vw - 40px)); }
}
.pos-confirm-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.pos-confirm-footer button { width: 100%; justify-content: center; }

.confirm-box { display: flex; gap: 12px; align-items: flex-start; }
.confirm-box p { color: var(--text2); font-size: 13px; line-height: 1.55; margin: 0; }
.info-icon,
.danger-icon {
  width: 38px; height: 38px; border-radius: 10px;
  background: var(--surface2);
  display: grid; place-items: center; flex-shrink: 0;
  color: var(--accent);
}
.danger-icon { background: rgba(239,68,68,.12); color: var(--danger); }

/* Client gate */
.client-gate-overlay { z-index: 2147483602 !important; }
.pos-client-gate-modal { }
@media (min-width: 768px) {
  .pos-client-gate-modal { width: min(560px, calc(100vw - 40px)); }
}
.pos-client-gate-body { display: grid; gap: 14px; }
.pos-client-gate-product {
  display: grid; grid-template-columns: 58px minmax(0,1fr);
  gap: 12px; align-items: center;
  border: 1px solid var(--border); background: var(--surface2);
  border-radius: 16px; padding: 10px;
}
.pos-client-gate-product-img {
  width: 58px; height: 58px; border-radius: 14px;
  border: 1px solid var(--border); background: #fff;
  color: var(--text3); display: grid; place-items: center;
  overflow: hidden; padding: 5px;
}
.pos-client-gate-product-img img,
.pos-cart-preview img { width: 100%; height: 100%; object-fit: contain; display: block; }
.pos-client-gate-product span,
.pos-client-gate-product small,
.pos-client-gate-help span { color: var(--text3); font-size: 11px; line-height: 1.35; }
.pos-client-gate-product b,
.pos-client-gate-help b { display: block; color: var(--text); font-size: 14px; line-height: 1.25; }
.pos-client-gate-help {
  display: grid; gap: 4px;
  border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--border));
  background: color-mix(in srgb, var(--accent) 8%, var(--surface2));
  border-radius: 16px; padding: 12px;
}
.pos-client-gate-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pos-client-gate-actions button { width: 100%; justify-content: center; }
@media (max-width: 390px) {
  .pos-client-gate-actions { grid-template-columns: 1fr; }
}

/* Scanner */
.scanner-overlay { z-index: 2147483605 !important; }
.pos-scanner-body { display: grid; gap: 12px; padding: 16px; }
.pos-scanner-info {
  display: flex; gap: 10px; align-items: flex-start;
  border: 1px solid var(--border); border-radius: 14px;
  background: var(--surface2); padding: 12px;
}
.pos-scanner-info b    { display: block; color: var(--text); font-size: 13px; line-height: 1.2; margin-bottom: 4px; }
.pos-scanner-info small{ display: block; color: var(--text3); font-size: 12px; line-height: 1.35; }
.pos-scanner-frame {
  position: relative; min-height: 300px;
  overflow: hidden; border: 1px solid var(--border);
  border-radius: 16px; background: #000;
}
.pos-scanner-reader { width: 100%; min-height: 300px; }
.pos-scanner-reader video { width: 100% !important; height: 300px !important; object-fit: cover !important; }
@media (max-width: 767px) {
  .pos-scanner-frame,
  .pos-scanner-reader { min-height: 340px; }
  .pos-scanner-reader video { height: 340px !important; }
}
.pos-scanner-loading {
  position: absolute; inset: 0;
  display: grid; place-items: center; align-content: center; gap: 10px;
  background: rgba(0,0,0,.72); color: white; z-index: 2;
}
.pos-scanner-loading p { margin: 0; font-size: 12px; font-weight: 800; }
.pos-scanner-error {
  display: flex; gap: 8px; align-items: flex-start;
  border: 1px solid rgba(239,68,68,.28); border-radius: 13px;
  background: rgba(239,68,68,.1); color: var(--danger);
  padding: 10px 12px; font-size: 12px; line-height: 1.35; font-weight: 800;
}
.pos-scanner-note { margin: 0; color: var(--text3); font-size: 12px; line-height: 1.4; }

/* ================================================================
   VISIBILIDAD MOBILE / DESKTOP
   ================================================================ */
.pos-mobile-only  { display: block; }
.pos-desktop-only { display: none; }
@media (min-width: 768px) {
  .pos-mobile-only  { display: none !important; }
  .pos-desktop-only { display: block !important; }
}

/* ================================================================
   SHARED COMPONENTS
   ================================================================ */

/* Icon button */
.pos-icon-btn {
  width: 42px; height: 42px; border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface2); color: var(--text);
  display: inline-grid; place-items: center; flex-shrink: 0;
}

/* Searchbox */
.pos-searchbox {
  display: grid;
  grid-template-columns: auto minmax(0,1fr) auto auto;
  align-items: center; gap: 8px;
  height: 48px; padding: 0 10px;
  border-radius: 18px;
  border: 1px solid var(--border); background: var(--surface);
  box-shadow: 0 8px 24px rgba(0,0,0,.14);
}
.pos-searchbox input {
  border: 0; background: transparent; outline: none;
  width: 100%; height: 100%; min-width: 0;
  color: var(--text); font-size: 16px;
}
.pos-searchbox button,
.pos-search-scan-btn {
  border: 0; background: var(--surface2); color: var(--text2);
  border-radius: 999px; width: 30px; height: 30px;
  display: grid; place-items: center; flex-shrink: 0;
}
.pos-search-scan-btn { color: var(--accent) !important; }

/* Category strip */
.pos-category-strip {
  display: flex; gap: 7px;
  overflow-x: auto; overflow-y: hidden;
  padding: 9px 0 4px;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.pos-category-strip::-webkit-scrollbar { display: none; }
.pos-category-strip button {
  border: 1px solid var(--border); background: var(--surface); color: var(--text2);
  border-radius: 999px; padding: 8px 12px;
  font-size: 12px; font-weight: 900; white-space: nowrap; flex-shrink: 0;
}
.pos-category-strip button.active { background: var(--accent); border-color: var(--accent); color: white; }
/* Category search desktop */
.pos-category-tools {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
}
.pos-category-searchbox {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  color: var(--text3);
  min-width: 0;
}
.pos-category-searchbox input {
  width: 100%;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: 14px;
}
.pos-category-searchbox button,
.pos-category-clear {
  border: 0;
  border-radius: 999px;
  background: var(--surface2);
  color: var(--text2);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.pos-category-searchbox button {
  width: 28px;
  height: 28px;
}
.pos-category-clear {
  height: 42px;
  padding: 0 13px;
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 950;
  white-space: nowrap;
}
.pos-category-clear:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.pos-category-empty {
  display: block;
  color: var(--text3);
  font-size: 12px;
  font-weight: 800;
  margin-top: 4px;
}

/* Price preset bar */
.pos-pre-price-bar {
  border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--border));
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--surface)), var(--surface));
  border-radius: 18px; padding: 11px;
  display: grid; gap: 10px;
  box-shadow: 0 10px 28px rgba(0,0,0,.10);
}
@media (min-width: 560px) {
  .pos-pre-price-bar { grid-template-columns: minmax(0,1fr) auto; align-items: center; }
}
.pos-pre-price-copy { display: grid; gap: 3px; min-width: 0; }
.pos-pre-price-copy b    { font-size: 13px; color: var(--text); }
.pos-pre-price-copy span { color: var(--text3); font-size: 12px; line-height: 1.35; }
.pos-pre-price-actions {
  display: grid; grid-template-columns: 1fr 1fr; gap: 7px; min-width: 0;
}
@media (min-width: 560px) { .pos-pre-price-actions { min-width: 200px; } }
.pos-pre-price-actions button {
  min-height: 40px;
  border: 1px solid var(--border); background: var(--surface); color: var(--text2);
  border-radius: 13px; padding: 7px 10px;
  font-weight: 950; font-size: 12px; cursor: pointer;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pos-pre-price-actions button.active {
  border-color: var(--accent); background: var(--accent); color: white;
  box-shadow: 0 8px 20px color-mix(in srgb, var(--accent) 30%, transparent);
}
.pos-pre-price-actions button:not(.active):hover { border-color: var(--accent); }

/* Client picker */
.pos-client-picker { position: relative; display: grid; gap: 6px; }
.pos-client-search-wrap { position: relative; z-index: 30; }
.pos-client-search {
  display: grid;
  grid-template-columns: auto minmax(0,1fr) auto;
  align-items: center; gap: 8px;
  height: 42px; border: 1px solid var(--border);
  border-radius: 14px; background: var(--surface);
  padding: 0 8px 0 12px;
}
.pos-client-search svg   { color: var(--text3); flex-shrink: 0; }
.pos-client-search input {
  width: 100%; height: 100%; min-width: 0; border: 0;
  background: transparent; outline: none; color: var(--text); padding: 0;
}
.pos-client-search button {
  width: 28px; height: 28px; border: 0; border-radius: 999px;
  background: var(--surface2); color: var(--text3);
  display: grid; place-items: center; flex-shrink: 0;
}
.pos-client-suggestions {
  position: absolute; left: 0; right: 0;
  top: calc(100% + 6px); z-index: 2147482500;
  max-height: 285px; overflow: auto;
  border: 1px solid var(--border); border-radius: 16px;
  background: var(--surface);
  box-shadow: 0 18px 50px rgba(0,0,0,.35);
  padding: 6px; display: grid; gap: 3px;
}
.pos-client-suggestions button {
  width: 100%; border: 0; border-radius: 12px;
  background: transparent; color: var(--text);
  text-align: left; padding: 9px 10px;
  display: grid; gap: 2px; cursor: pointer;
}
.pos-client-suggestions button:hover,
.pos-client-suggestions button.active { background: var(--surface2); }
.pos-client-suggestions b    { font-size: 13px; }
.pos-client-suggestions span,
.pos-client-no-results,
.pos-client-help { color: var(--text3); font-size: 11px; }
.pos-client-no-results { padding: 10px; text-align: center; }
.pos-help.danger { color: var(--danger); }
.form-label {
  color: var(--text3); font-size: 10px;
  font-weight: 950; text-transform: uppercase; letter-spacing: .08em;
}

/* Price dual buttons */
.pos-price-dual { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.pos-price-dual button {
  border: 1px solid var(--border); border-radius: 12px;
  padding: 6px 7px; background: var(--surface2);
  display: grid; gap: 2px; min-width: 0;
  text-align: left; cursor: pointer; color: var(--text);
  transition: border-color .1s;
}
.pos-price-dual button.active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 13%, var(--surface2));
}
.pos-price-dual button:hover:not(:disabled) { border-color: var(--accent); }
.pos-price-dual button:disabled { opacity: .45; cursor: not-allowed; }
.pos-price-dual small {
  color: var(--text3); font-size: 9px; font-weight: 900;
  text-transform: uppercase; letter-spacing: .06em;
}
.pos-price-dual b {
  color: var(--accent); font-family: var(--mono);
  font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ================================================================
   PRODUCT GRID & CARDS (mobile-first)
   ================================================================ */
.pos-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 8px;
}
@media (min-width: 420px) { .pos-grid { grid-template-columns: repeat(3, minmax(0,1fr)); } }
@media (min-width: 600px) { .pos-grid { grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); gap: 10px; } }

.pos-product {
  border: 1px solid var(--border); background: var(--surface);
  color: var(--text); border-radius: 18px; padding: 8px;
  text-align: left; min-width: 0;
  box-shadow: 0 8px 20px rgba(0,0,0,.10);
  display: grid; gap: 6px;
  position: relative; overflow: hidden;
  touch-action: manipulation; transition: transform .1s;
}
.pos-product:active   { transform: scale(.98); }
.pos-product.disabled { opacity: .5; filter: grayscale(.3); }

.pos-product-img {
  width: 100%; aspect-ratio: 1/1;
  border-radius: 14px; background: #fff;
  border: 1px solid var(--border);
  overflow: hidden; display: grid; place-items: center;
  padding: 4px; position: relative; color: var(--text3);
}
.pos-product-img img { width: 100%; height: 100%; object-fit: contain; display: block; }

.pos-added-pill {
  position: absolute; top: 5px; right: 5px;
  min-width: 25px; height: 25px; padding: 0 4px;
  border-radius: 999px; background: var(--accent); color: white;
  display: grid; place-items: center;
  font-size: 10px; font-weight: 900;
  box-shadow: 0 8px 20px rgba(0,0,0,.22);
}
.pos-product-info  { display: grid; gap: 3px; min-width: 0; }
.pos-product-top {
  display: flex; justify-content: space-between;
  align-items: center; gap: 4px;
  font-size: 9px; color: var(--text3);
  font-weight: 900; text-transform: uppercase;
}
.pos-product-top .promo  { color: var(--accent); }
.pos-product-top .danger { color: var(--danger); }
.pos-product strong {
  font-size: 11.5px; line-height: 1.15; min-height: 26px;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}
.pos-product small {
  color: var(--text3); font-size: 10px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.pos-product b { font-family: var(--mono); color: var(--accent); font-size: 12px; }

.pos-card-cart-breakdown {
  width: 100%;
  border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--border));
  background: color-mix(in srgb, var(--accent) 8%, var(--surface2));
  border-radius: 10px; padding: 5px 7px;
  display: grid; gap: 2px; font-size: 10px; line-height: 1.15; color: var(--text2);
}
.pos-card-cart-breakdown b    { color: var(--text); font-size: 10px; font-family: inherit; }
.pos-card-cart-breakdown span { color: var(--text2); font-size: 10px; font-weight: 800; }

.pos-product-skeleton {
  min-height: 148px; border-radius: 18px;
  background: linear-gradient(90deg, var(--surface), var(--surface2), var(--surface));
  animation: posPulse 1.2s infinite;
}
@keyframes posPulse { 0%,100% { opacity: .65; } 50% { opacity: 1; } }

.pos-empty {
  min-height: 200px; border: 1px dashed var(--border); border-radius: 22px;
  display: grid; place-items: center; align-content: center;
  gap: 8px; color: var(--text3); text-align: center; padding: 20px;
}
.pos-empty b      { color: var(--text); }
.pos-empty.compact{ min-height: 160px; }

.pos-load-more,
.pos-secondary-action {
  width: 100%; min-height: 44px; border-radius: 16px;
  border: 1px solid var(--border); background: var(--surface2); color: var(--text);
  display: inline-flex; align-items: center; justify-content: center;
  gap: 8px; font-weight: 900; margin-top: 12px; cursor: pointer;
}

/* ================================================================
   CART ITEMS
   ================================================================ */
.pos-cart-item,
.pos-cart-row {
  display: grid; grid-template-columns: 48px minmax(0,1fr);
  gap: 9px; padding: 9px;
  border-radius: 16px; border: 1px solid var(--border); background: var(--surface);
}
.pos-cart-row {
  border-radius: 0; border-left: 0; border-right: 0; border-top: 0;
  background: transparent;
}
.pos-cart-item-img {
  width: 48px; height: 48px; border-radius: 13px;
  background: white; border: 1px solid var(--border);
  display: grid; place-items: center; padding: 4px;
  overflow: hidden; color: var(--text3); flex-shrink: 0;
}
.pos-cart-item-img img { width: 100%; height: 100%; object-fit: contain; display: block; }
.pos-cart-item-main    { min-width: 0; display: grid; gap: 5px; }
.pos-cart-item-title   { display: flex; justify-content: space-between; gap: 8px; }
.pos-cart-item-title strong { font-size: 13px; line-height: 1.2; }
.pos-cart-item-title button {
  width: 30px; height: 30px; border-radius: 10px;
  border: 1px solid var(--border); background: var(--surface2);
  color: var(--danger); display: grid; place-items: center; flex-shrink: 0;
}
.pos-cart-item-meta    { display: flex; gap: 7px; flex-wrap: wrap; color: var(--text3); font-size: 11px; }
.pos-item-price-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.pos-item-price-switch button {
  border: 1px solid var(--border); background: var(--surface);
  color: var(--text2); border-radius: 11px; min-height: 34px;
  padding: 5px 7px; font-size: 10.5px; font-weight: 900; cursor: pointer;
}
.pos-item-price-switch button.active { border-color: var(--accent); background: var(--accent); color: white; }
.pos-cart-item-actions { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.pos-cart-item-actions > b { font-family: var(--mono); color: var(--accent); font-size: 13px; }

/* Stepper */
.pos-stepper {
  display: inline-grid; grid-template-columns: 34px 36px 34px;
  align-items: center; overflow: hidden;
  border: 1px solid var(--border); border-radius: 13px; background: var(--surface2);
}
.pos-stepper button { height: 34px; border: 0; background: transparent; color: var(--text); display: grid; place-items: center; }
.pos-stepper button:disabled { opacity: .35; }
.pos-stepper span { text-align: center; font-weight: 900; font-family: var(--mono); font-size: 14px; }

.pos-kg-input { display: grid; grid-template-columns: 26px minmax(0,1fr); align-items: center; gap: 6px; max-width: 130px; }
.pos-kg-input input { height: 34px; border-radius: 12px; }

/* Payment lines */
.pos-payment-line { display: grid; grid-template-columns: minmax(0,1fr) 110px; gap: 8px; margin-bottom: 8px; }
.pos-payments { display: grid; gap: 0; }

/* ================================================================
   CART FAB
   ================================================================ */
.pos-cart-fab {
  position: fixed;
  left: max(10px, env(safe-area-inset-left, 10px));
  right: max(10px, env(safe-area-inset-right, 10px));
  bottom: max(10px, env(safe-area-inset-bottom, 10px));
  z-index: 2147483000;
  min-height: 64px; border-radius: 22px;
  border: 1px solid rgba(255,255,255,.14);
  background: color-mix(in srgb, var(--surface) 92%, black 8%);
  color: var(--text);
  box-shadow: 0 18px 50px rgba(0,0,0,.45);
  display: flex; align-items: center;
  justify-content: space-between; gap: 12px;
  padding: 10px 14px; backdrop-filter: blur(18px); cursor: pointer;
}
.pos-cart-fab-left { display: inline-flex; align-items: center; gap: 10px; min-width: 0; overflow: hidden; }
.pos-cart-fab-left > span,
.pos-cart-fab-right { display: grid; gap: 1px; }
.pos-cart-fab b     { font-size: 14px; line-height: 1.2; }
.pos-cart-fab small,
.pos-cart-header span,
.pos-help { color: var(--text3); font-size: 11px; }
.pos-cart-fab-right { text-align: right; flex-shrink: 0; }
.pos-cart-fab-right b { color: var(--accent); font-family: var(--mono); }

/* Tablet+: FAB centrado */
@media (min-width: 560px) {
  .pos-cart-fab {
    left: 50%; right: auto;
    transform: translateX(-50%);
    width: min(520px, calc(100vw - 28px));
  }
}

/* ================================================================
   CART LAYER & SHEET
   ================================================================ */
.pos-cart-layer {
  position: fixed; inset: 0; z-index: 2147483001;
  background: rgba(0,0,0,.5);
  display: flex; align-items: flex-end; justify-content: center;
}
.pos-cart-sheet {
  width: 100%; max-height: 94dvh;
  background: var(--bg);
  border-radius: 26px 26px 0 0;
  border: 1px solid var(--border);
  box-shadow: 0 -24px 70px rgba(0,0,0,.5);
  display: grid; grid-template-rows: auto auto minmax(0,1fr) auto;
  overflow: hidden;
}
@media (min-width: 560px) {
  .pos-cart-sheet { width: min(560px, 100vw); }
  .pos-cart-layer { justify-content: center; }
}
.pos-cart-handle {
  width: 54px; height: 5px; border-radius: 999px;
  background: var(--border); margin: 9px auto 4px;
}
.pos-cart-header {
  display: flex; justify-content: space-between; gap: 12px;
  align-items: center; padding: 8px 14px 12px;
  border-bottom: 1px solid var(--border);
}
.pos-cart-header > div { display: grid; gap: 2px; }
.pos-cart-header b { font-size: 17px; }
.pos-cart-scroll { overflow: auto; padding: 12px 12px 0; overscroll-behavior: contain; }
.pos-mini-summary {
  display: flex; justify-content: space-between;
  gap: 7px; margin-bottom: 10px;
  font-size: 12px; font-weight: 900; flex-wrap: wrap;
}
.pos-mini-summary span {
  display: inline-flex; align-items: center; gap: 5px;
  border: 1px solid var(--border); background: var(--surface);
  color: var(--text2); border-radius: 999px; padding: 6px 9px;
}
.pos-mini-summary .warn { color: var(--warn); }
.pos-mobile-price-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.pos-mobile-price-actions button {
  border: 1px solid var(--border); background: var(--surface);
  color: var(--text2); border-radius: 12px; min-height: 36px;
  padding: 7px 8px; font-size: 11px; font-weight: 900; cursor: pointer;
}
.pos-mobile-price-actions button.active { border-color: var(--accent); background: var(--accent); color: white; }
.pos-cart-products { display: grid; gap: 8px; }

/* Sale options (details/summary) */
.pos-sale-options { display: grid; gap: 8px; margin-top: 12px; padding-bottom: 12px; }
.pos-sale-options details { border: 1px solid var(--border); border-radius: 18px; background: var(--surface); overflow: hidden; }
.pos-sale-options summary { padding: 13px; font-weight: 900; cursor: pointer; }
.pos-option-body { display: grid; gap: 10px; padding: 0 13px 13px; }
.pos-option-body label        { display: grid; gap: 5px; min-width: 0; }
.pos-option-body label > span {
  color: var(--text3); font-size: 10px; font-weight: 900;
  text-transform: uppercase; letter-spacing: .08em;
}
.pos-option-body select,
.pos-option-body input,
.pos-payment-line select,
.pos-payment-line input {
  width: 100%; min-width: 0; height: 42px;
  border-radius: 14px; border: 1px solid var(--border);
  background: var(--surface); color: var(--text);
  padding: 0 10px; font-size: 14px;
}
.pos-ticket-fixed {
  display: inline-flex; align-items: center; gap: 7px;
  border: 1px solid rgba(34,197,94,.25); background: rgba(34,197,94,.08);
  color: var(--text2); border-radius: 13px; padding: 9px 10px;
  font-size: 12px; font-weight: 900; min-height: 42px; width: 100%;
}

/* Delivery result */
.pos-delivery-ok {
  display: grid; gap: 5px;
  border: 1px solid rgba(34,197,94,.25); background: rgba(34,197,94,.08);
  color: var(--text2); border-radius: 14px; padding: 10px;
  font-size: 12px; margin-top: 10px;
}
.pos-delivery-ok.fallback { border-color: rgba(245,158,11,.32); background: rgba(245,158,11,.09); }
.pos-delivery-ok b        { color: var(--success); }
.pos-delivery-ok.fallback b { color: var(--warn); }
.pos-delivery-ok small    { color: var(--text3); font-size: 11px; line-height: 1.35; }
.pos-delivery-ok-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.pos-route-source {
  flex-shrink: 0; border-radius: 999px; padding: 4px 7px;
  font-size: 10px; font-weight: 950; letter-spacing: .04em; text-transform: uppercase;
}
.pos-route-source.google  { background: rgba(34,197,94,.13); color: var(--success); border: 1px solid rgba(34,197,94,.25); }
.pos-route-source.fallback{ background: rgba(245,158,11,.13); color: var(--warn);    border: 1px solid rgba(245,158,11,.25); }

/* Cart footer */
.pos-cart-footer {
  border-top: 1px solid var(--border); background: var(--surface);
  padding: 11px 14px max(12px, env(safe-area-inset-bottom, 12px));
  box-shadow: 0 -18px 44px rgba(0,0,0,.28);
}
.pos-totals { display: grid; gap: 4px; margin-bottom: 10px; }
.pos-totals > div { display: flex; justify-content: space-between; gap: 10px; color: var(--text2); font-size: 13px; }
.pos-totals .total { color: var(--text); font-size: 20px; font-weight: 900; padding-top: 4px; }
.pos-totals .total b { color: var(--accent); font-family: var(--mono); }
.debt-badge { margin-bottom: 10px; }

/* Floating finish button */
.pos-finish {
  width: 100%; min-height: 52px; border: 0; border-radius: 18px;
  background: var(--accent); color: white;
  display: inline-flex; align-items: center; justify-content: center;
  gap: 8px; font-size: 15px; font-weight: 950; cursor: pointer;
}
.pos-finish:disabled { opacity: .45; }

/* Cart preview dots */
.pos-cart-preview {
  position: fixed; right: 18px;
  bottom: max(84px, calc(env(safe-area-inset-bottom, 0px) + 84px));
  z-index: 2147482999; display: flex; align-items: center; cursor: pointer;
}
.pos-cart-preview span,
.pos-cart-preview b {
  width: 32px; height: 32px; border-radius: 999px;
  border: 2px solid var(--bg); background: white; color: var(--text);
  display: grid; place-items: center; overflow: hidden;
  margin-left: -8px; box-shadow: 0 8px 22px rgba(0,0,0,.25); font-size: 11px;
}

/* ================================================================
   MOBILE SHELL
   ================================================================ */
.pos-mobile-shell { padding-bottom: 120px; }
.pos-hero {
  display: flex; align-items: center; justify-content: space-between;
  gap: 14px; padding: 14px 16px;
  border: 1px solid var(--border); border-radius: 22px;
  background: radial-gradient(circle at top left, rgba(59,130,246,.2), transparent 34%), var(--surface);
  margin-bottom: 12px;
}
.pos-kicker, .pos-hero p { margin: 0; color: var(--text3); font-size: 12px; font-weight: 800; }

.pos-mobile-controls {
  position: sticky; top: 0; z-index: 15;
  padding: 8px 0 10px;
  background: color-mix(in srgb, var(--bg) 90%, transparent);
  backdrop-filter: blur(18px); display: grid; gap: 8px;
}
.pos-control-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.pos-mobile-client-field,
.pos-sort-mobile-field,
.pos-control-grid .pos-save-default-pref { grid-column: 1 / -1; }
.pos-control-grid label { display: grid; gap: 5px; min-width: 0; }
.pos-control-grid span  {
  color: var(--text3); font-size: 10px; font-weight: 900;
  text-transform: uppercase; letter-spacing: .08em;
}
.pos-control-grid select,
.pos-control-grid input {
  width: 100%; min-width: 0; height: 42px;
  border-radius: 14px; border: 1px solid var(--border);
  background: var(--surface); color: var(--text); padding: 0 10px; font-size: 14px;
}
.pos-product-section { padding-bottom: 16px; }

/* Botón "Usar como predeterminado" — debe leerse claramente como botón en mobile y desktop */
.pos-save-default-pref {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  width: 100%; min-height: 42px;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border));
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  color: var(--accent); border-radius: 14px;
  padding: 0 12px; font-size: 12px; font-weight: 950;
  white-space: nowrap; cursor: pointer;
  transition: background-color .12s, border-color .12s, transform .05s;
}
.pos-save-default-pref svg { flex-shrink: 0; }
.pos-save-default-pref:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 22%, var(--surface));
}
.pos-save-default-pref:active { transform: scale(.98); }

/* ================================================================
   DESKTOP SHELL (≥768px)
   ================================================================ */
.pos-desktop-mobile-shell {
  max-width: 1680px; margin: 0 auto;
  padding-bottom: 118px; min-width: 0; width: 100%;
}

/* Hero */
.pos-desktop-hero {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 18px; border: 1px solid var(--border); border-radius: 26px;
  background: radial-gradient(circle at top left, rgba(59,130,246,.22), transparent 34%), var(--surface);
  margin-bottom: 12px; box-shadow: 0 14px 40px rgba(0,0,0,.12);
  min-width: 0; overflow: hidden;
}
.pos-desktop-hero > div:first-child { min-width: 0; overflow: hidden; }
.pos-desktop-hero h2 {
  margin: 2px 0 4px; line-height: 1; letter-spacing: -.04em; color: var(--text);
  font-size: clamp(20px, 2.4vw, 34px);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pos-desktop-hero p { margin: 0; color: var(--text3); font-size: 13px; font-weight: 850; }
.pos-desktop-hero-actions {
  display: flex; align-items: center; justify-content: flex-end;
  gap: 10px; flex-wrap: wrap; flex-shrink: 0;
}
.pos-desktop-pill {
  min-height: 40px; display: inline-flex; align-items: center; gap: 7px;
  border: 1px solid var(--border); background: var(--surface2);
  color: var(--text2); border-radius: 999px; padding: 0 12px;
  font-size: 12px; font-weight: 950; white-space: nowrap;
}
.pos-desktop-pill.total {
  border-color: color-mix(in srgb, var(--accent) 34%, var(--border));
  color: var(--accent); font-family: var(--mono);
}

/* Sticky controls bar */
.pos-desktop-mobile-controls {
  position: relative;
  top: auto;
  z-index: 5;
  padding: 12px; border: 1px solid var(--border); border-radius: 24px;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(18px);
  box-shadow: 0 16px 48px rgba(0,0,0,.14);
  margin-bottom: 14px; min-width: 0;
}
.pos-searchbox-desktop { height: 52px; margin-bottom: 10px;}
.pos-searchbox-desktop input { font-size: 16px; }

/* Desktop control grid — 3 cols por defecto */
.pos-desktop-control-grid {
  display: grid;
  grid-template-columns: minmax(140px, 180px) minmax(170px, 220px) minmax(0,1fr) minmax(150px, 210px);
  gap: 10px; margin-top: 10px; align-items: end; min-width: 0;
}
.pos-desktop-control-grid label { display: grid; gap: 5px; min-width: 0; }
.pos-desktop-control-grid span {
  color: var(--text3); font-size: 10px; font-weight: 950;
  text-transform: uppercase; letter-spacing: .08em;
}
.pos-desktop-control-grid select,
.pos-desktop-control-grid input {
  width: 100%; min-width: 0; height: 42px;
  border-radius: 14px; border: 1px solid var(--border);
  background: var(--surface); color: var(--text); padding: 0 10px; font-size: 14px;
}
.pos-desktop-control-grid .pos-save-default-pref { height: 42px; }
.pos-desktop-client-field .form-label {
  color: var(--text3); font-size: 10px; font-weight: 950;
  text-transform: uppercase; letter-spacing: .08em;
}

/* Desktop product grid */
.pos-desktop-like-grid {
  grid-template-columns: repeat(auto-fill, minmax(clamp(138px, 14vw, 188px), 1fr));
  gap: 10px;
}
.pos-product-section-desktop { padding-bottom: 18px; }
.pos-product-section-desktop .pos-product { min-height: 270px; padding: 9px; border-radius: 20px; }
.pos-product-section-desktop .pos-product-img  { border-radius: 16px; }
.pos-product-section-desktop .pos-product strong { font-size: 12px; min-height: 28px; }
.pos-product-section-desktop .pos-price-dual.compact b { font-size: 10.5px; }

/* Desktop FAB */
.pos-cart-fab-desktop {
  left: 50% !important; right: auto !important;
  bottom: 18px !important;
  transform: translateX(-50%) !important;
  width: min(740px, calc(100vw - 48px)) !important;
  max-width: calc(100vw - 48px) !important;
  min-height: 70px; border-radius: 24px; padding: 11px 16px;
}

/* Desktop cart layer/sheet */
.pos-cart-layer-desktop {
  align-items: center !important; justify-content: center !important; padding: 20px;
}
.pos-cart-sheet-desktop {
  width: min(760px, calc(100vw - 40px)) !important;
  max-width: calc(100vw - 40px) !important;
  max-height: calc(100dvh - 40px) !important;
  border-radius: 28px !important;
}
.pos-cart-sheet-desktop .pos-cart-header { padding: 10px 16px 14px; }
.pos-cart-sheet-desktop .pos-cart-scroll  { padding: 14px 14px 0; }
.pos-cart-sheet-desktop .pos-cart-products-desktop {
  max-height: 36dvh; overflow: auto; padding-right: 3px;
}
.pos-cart-sheet-desktop .pos-sale-options { grid-template-columns: 1fr 1fr; align-items: start; }
.pos-cart-sheet-desktop .pos-cart-footer  { padding: 14px 16px 16px; }
.pos-cart-preview-desktop {
  bottom: 104px !important;
  right: max(calc(50% - 390px), 18px) !important;
  transform: none !important;
}

/* ================================================================
   DESKTOP RESPONSIVE ADJUSTMENTS
   ================================================================ */

/* 1024–1280px: pantalla mediana (con sidebar típica) */
@media (max-width: 1280px) and (min-width: 768px) {
  .pos-desktop-hero { padding: 14px 16px; border-radius: 22px; }
  .pos-desktop-hero h2 { font-size: clamp(18px, 2vw, 26px); }
  .pos-desktop-mobile-controls { top: 8px; padding: 10px; border-radius: 20px; }
  .pos-desktop-control-grid {
    grid-template-columns: minmax(0,1fr) minmax(0,1fr);
    gap: 9px;
  }
  .pos-desktop-client-field { grid-column: 1 / -1; order: 3; }
  .pos-desktop-like-grid {
    grid-template-columns: repeat(auto-fill, minmax(clamp(126px, 12vw, 164px), 1fr));
    gap: 9px;
  }
  .pos-product-section-desktop .pos-product { min-height: 248px; padding: 8px; }
  .pos-cart-fab-desktop {
    width: min(620px, calc(100vw - 32px)) !important;
    min-height: 64px; bottom: 14px !important;
  }
  .pos-cart-sheet-desktop { width: min(680px, calc(100vw - 32px)) !important; }
  .pos-cart-sheet-desktop .pos-sale-options { grid-template-columns: 1fr; }
  .pos-cart-preview-desktop { right: 18px !important; }
}

/* 768–1024px: tablet */
@media (max-width: 1024px) and (min-width: 768px) {
  .pos-desktop-hero-actions { display: none; }
  .pos-desktop-control-grid { grid-template-columns: 1fr; }
  .pos-desktop-like-grid {
    grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); gap: 8px;
  }
  .pos-product-section-desktop .pos-product { min-height: 228px; padding: 7px; }
  .pos-product-section-desktop .pos-product strong { font-size: 11.5px; }
  .pos-cart-fab-desktop { width: min(560px, calc(100vw - 28px)) !important; }
}

/* Pantalla de altura reducida */
@media (max-height: 720px) and (min-width: 768px) {
  .pos-desktop-hero { padding: 12px 14px; margin-bottom: 9px; }
  .pos-desktop-hero h2 { font-size: 20px; }
  .pos-desktop-mobile-controls { padding: 9px; }
  .pos-searchbox-desktop { height: 46px; }
  .pos-pre-price-bar { margin: 7px 0 8px; padding: 9px; }
  .pos-category-strip button { min-height: 32px; padding-block: 6px; }
  .pos-cart-fab-desktop { min-height: 60px; }
  .pos-cart-sheet-desktop .pos-cart-products-desktop { max-height: 28dvh; }
}

/* Extra large */
@media (min-width: 1440px) {
  .pos-desktop-like-grid { grid-template-columns: repeat(auto-fill, minmax(188px, 1fr)); gap: 12px; }
  .pos-product-section-desktop .pos-product { min-height: 290px; padding: 10px; }
  .pos-product-section-desktop .pos-product strong { font-size: 13px; min-height: 30px; }
  .pos-product-section-desktop .pos-price-dual.compact b { font-size: 11px; }
}

/* ================================================================
   FIX FINAL RESPONSIVE POS — evita cortes con sidebar/devtools
   Esto pisa reglas anteriores usando el ancho REAL del contenedor.
   ================================================================ */

html,
body {
  max-width: 100%;
  overflow-x: hidden !important;
}

.pos-desktop-only,
.pos-desktop-only *,
.pos-mobile-only,
.pos-mobile-only * {
  box-sizing: border-box;
}

.pos-desktop-only,
.pos-desktop-mobile-shell,
.pos-desktop-hero,
.pos-desktop-mobile-controls,
.pos-product-section-desktop,
.pos-desktop-like-grid,
.pos-category-strip,
.pos-searchbox,
.pos-pre-price-bar,
.pos-desktop-control-grid {
  min-width: 0 !important;
  max-width: 100% !important;
}

.pos-desktop-only {
  width: 100%;
  overflow-x: clip !important;
}

.pos-desktop-mobile-shell {
  width: 100% !important;
  max-width: 1680px !important;
  margin-inline: auto;
  padding-inline: clamp(6px, 1.2vw, 16px);
  padding-bottom: 112px;
  overflow-x: clip !important;
  container-type: inline-size;
}

.pos-desktop-hero {
  width: 100%;
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  overflow: hidden;
}

.pos-desktop-hero > div:first-child {
  min-width: 0;
  overflow: hidden;
}

.pos-desktop-hero h2,
.pos-desktop-hero p {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pos-desktop-hero-actions {
  min-width: 0;
  max-width: 100%;
}

.pos-desktop-pill {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pos-desktop-mobile-controls {
  width: 100%;
  overflow: visible !important;
}

.pos-searchbox,
.pos-searchbox-desktop {
  width: 100%;
  grid-template-columns: auto minmax(0, 1fr) auto auto !important;
}

.pos-searchbox input,
.pos-client-search input,
.pos-desktop-control-grid select,
.pos-desktop-control-grid input,
.pos-control-grid select,
.pos-control-grid input {
  min-width: 0 !important;
  max-width: 100% !important;
}

.pos-pre-price-bar,
.pos-pre-price-bar.compact {
  width: 100%;
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 360px);
  align-items: center;
  overflow: hidden;
}

.pos-pre-price-copy {
  min-width: 0;
}

.pos-pre-price-copy span,
.pos-pre-price-copy b {
  overflow-wrap: anywhere;
}

.pos-pre-price-actions {
  min-width: 0 !important;
  width: 100% !important;
  max-width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
}

.pos-pre-price-actions button {
  min-width: 0;
  width: 100%;
}

.pos-desktop-control-grid {
  width: 100%;
  display: grid !important;
  grid-template-columns: minmax(150px, 190px) minmax(170px, 220px) minmax(260px, 1fr) minmax(150px, 210px);
  gap: 10px;
}

.pos-desktop-client-field {
  min-width: 0;
}

.pos-client-search-wrap,
.pos-client-search {
  min-width: 0;
  max-width: 100%;
}

.pos-client-suggestions {
  max-width: min(100%, calc(100vw - 32px));
}

.pos-category-strip,
.pos-category-strip-desktop {
  width: 100%;
  max-width: 100%;
  overflow-x: auto !important;
  overflow-y: hidden;
  padding-bottom: 6px;
  cursor: default;
  touch-action: auto;
  overscroll-behavior-x: contain;
}

.pos-category-strip-desktop {
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

.pos-category-strip-desktop::-webkit-scrollbar {
  display: block !important;
  height: 8px;
}

.pos-category-strip-desktop::-webkit-scrollbar-track {
  background: transparent;
}

.pos-category-strip-desktop::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 999px;
}

.pos-category-strip button {
  flex: 0 0 auto;
  cursor: pointer;
}

.pos-desktop-like-grid {
  width: 100%;
  display: grid !important;
  grid-template-columns: repeat(auto-fill, minmax(min(150px, 100%), 1fr)) !important;
  gap: clamp(7px, 1vw, 12px);
}

.pos-product-section-desktop .pos-product {
  min-width: 0;
  width: 100%;
  min-height: auto !important;
  align-content: start;
}

.pos-product-section-desktop .pos-product-img {
  max-height: 190px;
}

.pos-product-section-desktop .pos-product strong {
  min-height: 28px;
}

.pos-price-dual,
.pos-price-dual.compact {
  min-width: 0;
  width: 100%;
}

.pos-price-dual button {
  min-width: 0;
}

.pos-cart-fab-desktop {
  width: min(680px, calc(100dvw - 28px)) !important;
  max-width: calc(100dvw - 28px) !important;
  left: 50% !important;
  right: auto !important;
  transform: translateX(-50%) !important;
}

.pos-cart-preview-desktop {
  max-width: calc(100dvw - 28px);
}

/* Container queries: responden al ancho del área útil, no al viewport entero.
   Esto arregla cuando hay sidebar, devtools o ventanas partidas. */
@container (max-width: 1180px) {
  .pos-desktop-hero {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    padding: 14px;
    border-radius: 22px;
  }

  .pos-desktop-hero-actions {
    width: 100%;
    justify-content: space-between;
  }

  .pos-desktop-pill {
    max-width: 100%;
  }

  .pos-desktop-mobile-controls {
    top: 8px !important;
    padding: 10px;
    border-radius: 20px;
  }

  .pos-desktop-control-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
  }

  .pos-desktop-client-field {
    grid-column: 1 / -1 !important;
    order: 3;
  }

  .pos-desktop-like-grid {
    grid-template-columns: repeat(auto-fill, minmax(min(138px, 100%), 1fr)) !important;
  }

  .pos-cart-sheet-desktop .pos-sale-options {
    grid-template-columns: 1fr !important;
  }
}

@container (max-width: 820px) {
  .pos-desktop-mobile-shell {
    padding-inline: 6px;
    padding-bottom: 106px;
  }

  .pos-desktop-hero {
    padding: 12px;
    border-radius: 20px;
  }

  .pos-desktop-hero-actions {
    display: none !important;
  }

  .pos-desktop-hero h2 {
    white-space: normal !important;
    font-size: 22px;
  }

  .pos-desktop-mobile-controls {
    position: relative !important;
    top: auto !important;
    padding: 9px;
  }

  .pos-pre-price-bar,
  .pos-pre-price-bar.compact {
    grid-template-columns: 1fr !important;
  }

  .pos-desktop-control-grid {
    grid-template-columns: 1fr !important;
  }

  .pos-desktop-client-field {
    grid-column: auto !important;
  }

  .pos-desktop-like-grid {
    grid-template-columns: repeat(auto-fill, minmax(min(128px, 100%), 1fr)) !important;
  }

  .pos-product-section-desktop .pos-product {
    padding: 7px;
    border-radius: 17px;
  }

  .pos-product-section-desktop .pos-product strong {
    font-size: 11.5px;
  }

  .pos-product-section-desktop .pos-product-img {
    max-height: 150px;
  }

  .pos-cart-fab-desktop {
    width: min(540px, calc(100dvw - 20px)) !important;
    min-height: 62px;
    bottom: 10px !important;
    border-radius: 20px;
  }

  .pos-cart-sheet-desktop {
    width: min(560px, calc(100dvw - 20px)) !important;
    max-width: calc(100dvw - 20px) !important;
  }
}

@container (max-width: 620px) {
  .pos-category-tools {
    grid-template-columns: 1fr;
  }

  .pos-category-clear {
    width: 100%;
    justify-content: center;
  }

  .pos-desktop-like-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .pos-searchbox-desktop {
    height: 48px;
  }

  .pos-pre-price-copy span {
    font-size: 11px;
  }

  .pos-category-strip button {
    padding-inline: 10px;
  }
}

@container (max-width: 430px) {
  .pos-desktop-like-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 7px;
  }

  .pos-product-section-desktop .pos-product {
    padding: 6px;
  }

  .pos-price-dual.compact b {
    font-size: 9.5px !important;
  }
}

/* Fallback para navegadores sin container queries */
@media (max-width: 1280px) {
  .pos-desktop-hero {
    grid-template-columns: minmax(0, 1fr);
  }

  .pos-desktop-control-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
  }

  .pos-desktop-client-field {
    grid-column: 1 / -1 !important;
  }
}

@media (max-width: 1024px) {
  .pos-category-tools {
    grid-template-columns: 1fr;
  }

  .pos-category-clear {
    width: 100%;
    justify-content: center;
  }

  .pos-desktop-hero-actions {
    display: none !important;
  }

  .pos-pre-price-bar,
  .pos-pre-price-bar.compact {
    grid-template-columns: 1fr !important;
  }

  .pos-desktop-control-grid {
    grid-template-columns: 1fr !important;
  }

  .pos-desktop-client-field {
    grid-column: auto !important;
  }
}

@media (max-width: 767px) {
  .pos-desktop-only {
    display: none !important;
  }

  .pos-mobile-only {
    display: block !important;
  }
}



/* ================================================================
   DESKTOP: máximo 6 productos por fila
   Esto pisa los auto-fill anteriores para que en pantallas grandes
   no aparezcan 7, 8 o más cards por fila.
   ================================================================ */
@media (min-width: 768px) {
  .pos-desktop-like-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }
}

@media (min-width: 960px) {
  .pos-desktop-like-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

@media (min-width: 1180px) {
  .pos-desktop-like-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
  }
}

@media (min-width: 1440px) {
  .pos-desktop-like-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  }
}


/* ================================================================
   FIX: toolbar de productos + clicks de categorías desktop
   ================================================================ */
.pos-product-toolbar-desktop {
  position: relative !important;
  top: auto !important;
  z-index: 5 !important;
  margin-bottom: 14px !important;
}

.pos-category-strip button {
  pointer-events: auto;
  cursor: pointer;
  user-select: none;
}


/* ================================================================
   FIX: scrollbar de categorías más gruesa y fácil de agarrar
   Mantiene el click normal en categorías, sin drag manual.
   ================================================================ */
@media (min-width: 768px) {
  .pos-category-strip-desktop {
    padding-bottom: 12px !important;
    scrollbar-width: auto !important;
    scrollbar-color: var(--accent) color-mix(in srgb, var(--surface2) 82%, transparent) !important;
  }

  .pos-category-strip-desktop::-webkit-scrollbar {
    display: block !important;
    height: 14px !important;
  }

  .pos-category-strip-desktop::-webkit-scrollbar-track {
    background: color-mix(in srgb, var(--surface2) 85%, transparent) !important;
    border-radius: 999px !important;
    margin-inline: 8px !important;
  }

  .pos-category-strip-desktop::-webkit-scrollbar-thumb {
    background: var(--accent) !important;
    border-radius: 999px !important;
    border: 3px solid color-mix(in srgb, var(--surface2) 85%, transparent) !important;
    min-width: 44px !important;
  }

  .pos-category-strip-desktop::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--accent) 82%, white 18%) !important;
  }
}

      `}</style>
    </AppLayout>
  );
}
