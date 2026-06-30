/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import type { PaymentMethod, Product, ProductCategory, Supplier } from "@/types";
import { categoryName, fmtMoney, normalizeArray, num } from "@/lib/helpers";
import { todayInputAR } from "@/lib/dateAR";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  Check,
  History,
  Minus,
  Package,
  PackagePlus,
  Plus,
  RefreshCcw,
  ScanBarcode,
  Search,
  ShoppingCart,
  Trash2,
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
];

type StockLocation = "LOCAL" | "DEPOSITO";
type ProductSortMode = "name-asc" | "name-desc" | "category-asc" | "category-desc";

type PurchaseCartItem = {
  product: Product;
  quantity: number;
  quantityKg?: number;
  unitCost: number;
  originalCost: number;
};

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
} | null;

const DELIVERY_SKU = "ENVIO-FLETE2";
const PURCHASE_SKU_SCANNER_ELEMENT_ID = "comarpos-purchase-sku-scanner";

function stockLocationLabel(stockLocation: StockLocation) {
  return stockLocation === "DEPOSITO" ? "Minorista" : "Mayorista";
}

function stockLocationLabelLower(stockLocation: StockLocation) {
  return stockLocation === "DEPOSITO" ? "minorista" : "mayorista";
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

function isCompositeProduct(product?: Product | null) {
  return product?.type === "COMPUESTO";
}

function isPurchasableProduct(product?: Product | null) {
  if (!product) return false;
  if (product.isActive === false) return false;
  if (product.isService) return false;
  if (isDeliveryProduct(product)) return false;
  if (isCompositeProduct(product)) return false;
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

function stockLabel(product: Product, stockLocation: StockLocation) {
  const stock = productRawStockByLocation(product, stockLocation);
  return product.saleUnit === "KG" ? `${stock} kg` : `${stock}`;
}

function productTotalStockLabel(product: Product) {
  if (product.saleUnit === "KG") {
    const total = num(product.stockLocalKg) + num(product.stockDepositoKg);
    return `${total.toLocaleString("es-AR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    })} kg`;
  }

  return String(num(product.stockLocal) + num(product.stockDeposito));
}

function purchaseCost(product: Product) {
  return num((product as Product & { purchasePrice?: number | null }).purchasePrice);
}

function cartLineKey(item: PurchaseCartItem) {
  return item.product.id;
}

function cartItemCounterLabel(item?: PurchaseCartItem | null) {
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

function normalizeDecimalDraft(value: string) {
  const normalized = value.replace(/,/g, ".");
  let result = "";
  let hasDot = false;

  for (const char of normalized) {
    if (/\d/.test(char)) {
      result += char;
      continue;
    }

    if (char === "." && !hasDot) {
      result += char;
      hasDot = true;
    }
  }

  return result;
}

function parseDecimalDraft(value: string) {
  const normalized = value.trim().replace(/,/g, ".");

  if (!normalized || normalized === ".") return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function editableNumberValue(value: number) {
  if (!Number.isFinite(value)) return "";
  return String(value);
}

function normalizeProductsPayload(data: any) {
  if (Array.isArray(data)) return data as Product[];
  if (Array.isArray(data?.data)) return data.data as Product[];
  if (Array.isArray(data?.products)) return data.products as Product[];
  if (Array.isArray(data?.items)) return data.items as Product[];
  if (Array.isArray(data?.results)) return data.results as Product[];
  return normalizeArray<Product>(data);
}

async function fetchPurchaseData() {
  const [p, c, s] = await Promise.all([
    api.get("/products"),
    api.get("/categories"),
    api.get("/suppliers").catch(() => ({ data: [] })),
  ]);

  const products = normalizeProductsPayload(p.data).filter((x) => isPurchasableProduct(x));
  const categories = normalizeArray<ProductCategory>(c.data);
  const suppliers = normalizeArray<Supplier>((s.data as any)?.content ?? s.data);

  return { products, categories, suppliers };
}

export default function ComprasPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [cart, setCart] = useState<PurchaseCartItem[]>([]);
  const [costDrafts, setCostDrafts] = useState<Record<string, string>>({});

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sortMode, setSortMode] = useState<ProductSortMode>("name-asc");
  const [stockLocation, setStockLocation] = useState<StockLocation>("LOCAL");

  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => todayInputAR());
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("TRANSFERENCIA");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
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

  const load = async (showSuccess = false) => {
    setLoading(true);

    try {
      const data = await fetchPurchaseData();
      setProducts(data.products);
      setCategories(data.categories);
      if (showSuccess) toast.success("Compras actualizado correctamente");
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar datos de compras");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    fetchPurchaseData()
      .then((data) => {
        if (!alive) return;
        setProducts(data.products);
        setCategories(data.categories);
        setSuppliers(data.suppliers);
      })
      .catch((e) => {
        console.error(e);
        if (alive) toast.error("Error al cargar datos de compras");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const result = products.filter((p) => {
      return (
        (!q ||
          p.name.toLowerCase().includes(q) ||
          String(p.sku ?? "").toLowerCase().includes(q)) &&
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

  const total = cart.reduce((acc, item) => {
    const qty = item.product.saleUnit === "KG" ? num(item.quantityKg) : item.quantity;
    return acc + item.unitCost * qty;
  }, 0);

  const cartUnits = cart.reduce((acc, item) => {
    if (item.product.saleUnit === "KG") return acc + 1;
    return acc + item.quantity;
  }, 0);

  const changedCosts = cart.filter((item) => item.unitCost !== item.originalCost).length;
  const cartPreview = cart.slice(0, 3);

  const buildCartWithProduct = (product: Product) => {
    const exists = cart.find((i) => i.product.id === product.id);

    if (exists) {
      return cart.map((i) => {
        if (i.product.id !== product.id) return i;

        if (product.saleUnit === "KG") {
          return { ...i, quantityKg: num(i.quantityKg) + 1 };
        }

        return { ...i, quantity: i.quantity + 1 };
      });
    }

    const cost = purchaseCost(product);

    return [
      ...cart,
      {
        product,
        quantity: product.saleUnit === "KG" ? 0 : 1,
        quantityKg: product.saleUnit === "KG" ? 1 : undefined,
        unitCost: cost,
        originalCost: cost,
      },
    ];
  };

  const add = (product: Product) => {
    if (!isPurchasableProduct(product)) {
      toast.error("Este producto no se puede cargar como compra de mercadería");
      return;
    }

    setCart(buildCartWithProduct(product));
  };

  const stopSkuScanner = async () => {
    const scanner = scannerInstanceRef.current;
    scannerHandledRef.current = false;
    if (!scanner) return;

    try {
      const state = scanner.getState?.();
      if (state === 2) await scanner.stop();
    } catch (e) {
      console.warn("No se pudo detener el scanner de compras", e);
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

    if (!isPurchasableProduct(product)) {
      scannerHandledRef.current = false;
      setScannerError("Ese SKU pertenece a un servicio/promo/envío y no se agrega a compras.");
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

        const scanner = new Html5Qrcode(PURCHASE_SKU_SCANNER_ELEMENT_ID);
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
  }, [skuScannerOpen, products, cart]);

  const setQty = (lineKey: string, value: number) => {
    setCart((prev) =>
      prev.map((i) => {
        if (cartLineKey(i) !== lineKey) return i;
        return { ...i, quantity: Math.max(1, Math.trunc(value)) };
      }),
    );
  };

  const setKg = (lineKey: string, value: number) => {
    setCart((prev) =>
      prev.map((i) => {
        if (cartLineKey(i) !== lineKey) return i;
        return { ...i, quantityKg: Math.max(0.001, value) };
      }),
    );
  };

  const setCost = (lineKey: string, value: number) => {
    setCart((prev) =>
      prev.map((i) => {
        if (cartLineKey(i) !== lineKey) return i;
        return { ...i, unitCost: Math.max(0, value) };
      }),
    );
  };

  const setCostDraft = (lineKey: string, rawValue: string) => {
    const draft = normalizeDecimalDraft(rawValue);

    setCostDrafts((prev) => ({ ...prev, [lineKey]: draft }));

    const parsed = parseDecimalDraft(draft);
    if (parsed !== null) setCost(lineKey, parsed);
  };

  const commitCostDraft = (lineKey: string) => {
    const draft = costDrafts[lineKey];
    if (draft === undefined) return;

    const parsed = parseDecimalDraft(draft);
    setCost(lineKey, parsed === null ? 0 : parsed);

    setCostDrafts((prev) => {
      const next = { ...prev };
      delete next[lineKey];
      return next;
    });
  };

  const remove = (lineKey: string) => {
    setCart((prev) => prev.filter((i) => cartLineKey(i) !== lineKey));
    setCostDrafts((prev) => {
      const next = { ...prev };
      delete next[lineKey];
      return next;
    });
  };

  const clearPurchase = () => {
    setCart([]);
    setCostDrafts({});
    setSupplierId("");
    setInvoiceNumber("");
    setDescription("");
    setPaymentMethod("TRANSFERENCIA");
    setPurchaseDate(todayInputAR());
    setStockLocation("LOCAL");
  };

  const validatePurchase = () => {
    if (!cart.length) {
      toast.error("Agregá productos a la compra");
      return false;
    }

    for (const item of cart) {
      const qty = item.product.saleUnit === "KG" ? num(item.quantityKg) : item.quantity;

      if (qty <= 0) {
        toast.error(`Cantidad inválida para ${item.product.name}`);
        return false;
      }

      if (!Number.isFinite(item.unitCost) || item.unitCost < 0) {
        toast.error(`Costo inválido para ${item.product.name}`);
        return false;
      }
    }

    return true;
  };

  const submitPurchase = async () => {
    if (!validatePurchase()) return;

    setSubmitting(true);
    const toastId = toast.loading("Registrando compra...");

    try {
      const payload = {
        supplierId: supplierId || undefined,
        invoiceNumber: invoiceNumber.trim() || undefined,
        description: description.trim() || undefined,
        paymentMethod,
        to: stockLocation,
        date: purchaseDate,
        items: cart.map((item) => ({
          productId: item.product.id,
          unitCost: item.unitCost,
          quantity: item.product.saleUnit === "KG" ? undefined : item.quantity,
          quantityKg: item.product.saleUnit === "KG" ? num(item.quantityKg) : undefined,
        })),
      };

      await api.post("/purchases", payload);

      clearPurchase();
      toast.success("Compra registrada correctamente", { id: toastId });
      await load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Error al registrar compra"), { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const openSubmitConfirm = () => {
    if (!validatePurchase()) return;

    setConfirmModal({
      title: "Finalizar compra",
      message: `¿Confirmás registrar esta compra por ${fmtMoney(total)}? Se va a agregar mercadería a ${stockLocationLabelLower(stockLocation)} y se va a crear un egreso en finanzas.`,
      confirmText: "Finalizar compra",
      danger: false,
      onConfirm: submitPurchase,
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

  const renderProductCost = (product: Product, compact = false, disabled = false) => {
    const cost = purchaseCost(product);

    return (
      <div className={compact ? "pos-price-dual compact purchase-single" : "pos-price-dual purchase-single"}>
        <button
          type="button"
          className="active"
          onClick={() => add(product)}
          disabled={disabled}
          title="Agregar a compra"
        >
          <small>Costo</small>
          <b>{fmtMoney(cost)}{product.saleUnit === "KG" ? "/kg" : ""}</b>
        </button>
      </div>
    );
  };

  const renderProductCard = (product: Product, mobile = false) => {
    const imageUrl = getProductImageUrl(product);
    const cartItem = cart.find((item) => item.product.id === product.id);
    const cartQtyLabel = cartItemCounterLabel(cartItem);

    return (
      <article
        key={product.id}
        className={mobile ? "pos-product" : "card pos-product-card"}
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
          {cartItem && <span className="pos-added-pill">x{cartQtyLabel}</span>}
        </span>

        {mobile ? (
          <span className="pos-product-info">
            <span className="pos-product-top">
              <span>{product.saleUnit}</span>
              <span>Stock total {productTotalStockLabel(product)}</span>
            </span>
            <strong>{product.name}</strong>
            <small>{product.sku ?? "SIN-SKU"}</small>
            {renderProductCost(product, true)}
          </span>
        ) : (
          <>
            <div className="pos-product-meta">
              <span className="badge badge-gray">{product.saleUnit}</span>
              <span className="muted">Stock total {productTotalStockLabel(product)}</span>
            </div>
            <b className="pos-product-title">{product.name}</b>
            <span className="muted small">{categoryName(product)} · {product.sku ?? "SIN-SKU"}</span>
            {renderProductCost(product)}
            {cartItem && (
              <div className="pos-card-cart-breakdown">
                <b>En compra:</b>
                <span>{cartQtyLabel} · costo {fmtMoney(cartItem.unitCost)}</span>
              </div>
            )}
            <span className="muted small">
              Stock {stockLocationLabelLower(stockLocation)} actual: {stockLabel(product, stockLocation)}
            </span>
            <span className="muted small">Tocá el costo para agregarlo</span>
          </>
        )}
      </article>
    );
  };

  const renderCartItem = (item: PurchaseCartItem, compact = false, reactKey?: string) => {
    const lineKey = cartLineKey(item);
    const itemReactKey = reactKey ?? lineKey;
    const imageUrl = getProductImageUrl(item.product);
    const qty = item.product.saleUnit === "KG" ? num(item.quantityKg) : item.quantity;
    const lineTotal = item.unitCost * qty;
    const costChanged = item.unitCost !== item.originalCost;

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
            <strong>{item.product.name}</strong>
            <button type="button" onClick={() => remove(lineKey)}>
              <Trash2 size={14} />
            </button>
          </div>

          <div className="pos-cart-item-meta">
            <span>{item.product.sku ?? "SIN-SKU"}</span>
            <span>{item.product.saleUnit === "KG" ? "Compra por kg" : "Compra por unidad"}</span>
            <span>Stock {stockLocationLabelLower(stockLocation)}: {stockLabel(item.product, stockLocation)}</span>
          </div>

          <div className="pos-cart-purchase-grid">
            {item.product.saleUnit === "KG" ? (
              <label className="pos-kg-input purchase-qty-input">
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
                <button type="button" onClick={() => setQty(lineKey, item.quantity - 1)}>
                  <Minus size={14} />
                </button>
                <span>{item.quantity}</span>
                <button type="button" onClick={() => setQty(lineKey, item.quantity + 1)}>
                  <Plus size={14} />
                </button>
              </div>
            )}

            <label className="purchase-cost-input">
              <span>Costo</span>
              <input
                type="text"
                inputMode="decimal"
                value={costDrafts[lineKey] ?? editableNumberValue(item.unitCost)}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setCostDraft(lineKey, e.target.value)}
                onBlur={() => commitCostDraft(lineKey)}
              />
            </label>
          </div>

          {costChanged && (
            <div className="purchase-cost-warning">
              <AlertTriangle size={13} />
              Cambió el costo: antes {fmtMoney(item.originalCost)}, ahora {fmtMoney(item.unitCost)}.
            </div>
          )}

          <div className="pos-cart-item-actions purchase-line-total">
            <span>{cartItemCounterLabel(item)} x {fmtMoney(item.unitCost)}</span>
            <b>{fmtMoney(lineTotal)}</b>
          </div>
        </div>
      </article>
    );
  };

  return (
    <AppLayout
      title="Compras"
      subtitle="Compra de mercadería: elegí si ingresa a mayorista o minorista"
      actions={
        <Link href="/compras/historial" className="btn btn-secondary btn-sm">
          <History size={15} />
          Historial de compras
        </Link>
      }
    >
      <div className="pos-desktop-only">
        <div className="pos-root">
          <section>
            <div className="pos-toolbar">
              <div className="pos-search">
                <Search size={14} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar producto o SKU..."
                />
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm pos-scan-desktop-btn"
                onClick={openSkuScanner}
                title="Escanear SKU con cámara"
              >
                <ScanBarcode size={15} />
                Escanear
              </button>

              <select className="pos-filter" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                className="pos-filter pos-sort-filter"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as ProductSortMode)}
                title="Ordenar productos"
              >
                <option value="name-asc">Nombre A-Z</option>
                <option value="name-desc">Nombre Z-A</option>
                <option value="category-asc">Categoría A-Z</option>
                <option value="category-desc">Categoría Z-A</option>
              </select>

              <select
                className="pos-filter"
                value={stockLocation}
                onChange={(e) => setStockLocation(e.target.value as StockLocation)}
                title="Elegí si la compra entra a mayorista o minorista"
              >
                <option value="LOCAL">Agregar a Mayorista</option>
                <option value="DEPOSITO">Agregar a Minorista</option>
              </select>

              <button className="btn btn-secondary btn-sm pos-refresh-btn" onClick={() => load(true)} disabled={loading}>
                <RefreshCcw size={14} />
                Actualizar
              </button>

              <Link href="/compras/historial" className="btn btn-primary btn-sm pos-history-btn">
                <History size={14} />
                Historial
              </Link>
            </div>

            <section className="pos-pre-price-bar purchase-info-bar">
              <div className="pos-pre-price-copy">
                <b>Compra de mercadería</b>
                <span>
                  Los productos se agregan con el costo actual cargado. Elegí si entran a mayorista o minorista, y si el proveedor cambió el precio editá el costo en el carrito antes de finalizar.
                </span>
              </div>
              <div className="purchase-total-chip">
                <small>Total compra</small>
                <b>{fmtMoney(total)}</b>
              </div>
            </section>

            <div className="pos-products-grid">
              {loading ? <div className="skeleton" style={{ height: 240 }} /> : filtered.map((p) => renderProductCard(p))}
            </div>
          </section>

          <aside className="card pos-cart">
            <div className="pos-cart-body">
              <div className="pos-cart-head">
                <ShoppingCart size={18} />
                <b>Compra</b>
                <span>{cart.length} items</span>
              </div>

              <div className="badge badge-blue stock-badge"><Warehouse size={13} /> Ingresa a: {stockLocationLabel(stockLocation)}</div>

              <div className="form-group">
                <label className="form-label">Agregar mercadería a</label>
                <select value={stockLocation} onChange={(e) => setStockLocation(e.target.value as StockLocation)}>
                  <option value="LOCAL">Mayorista</option>
                  <option value="DEPOSITO">Minorista</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Proveedor</label>
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                    <option value="">Sin proveedor</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha</label>
                  <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Factura / remito proveedor</label>
                <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Ej: FC A 0001-00001234" />
              </div>

              <div className="form-group">
                <label className="form-label">Método de pago</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                  {methods.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="pos-cart-items purchase-cart-items">
                {cart.map((item, index) => renderCartItem(item, false, `${cartLineKey(item)}-${index}`))}
                {!cart.length && <div className="pos-empty compact"><ShoppingCart size={28} /><b>Compra vacía</b><span>Tocá productos o escaneá un SKU.</span></div>}
              </div>

              <div className="form-group">
                <label className="form-label">Observación</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Opcional"
                  rows={3}
                />
              </div>
            </div>

            <div className="pos-cart-footer desktop-footer">
              <div className="pos-totals">
                <div><span>Productos</span><b>{cart.length}</b></div>
                {changedCosts > 0 && <div><span>Costos modificados</span><b>{changedCosts}</b></div>}
                <div className="total"><span>Total egreso</span><b>{fmtMoney(total)}</b></div>
              </div>
              <button className="btn btn-primary full finish-btn" disabled={submitting || !cart.length} onClick={openSubmitConfirm}>
                <Check size={17} />
                {submitting ? "Registrando compra..." : `Finalizar compra · ${fmtMoney(total)}`}
              </button>
            </div>
          </aside>
        </div>
      </div>

      <div className="pos-mobile-only">
        <div className="pos-mobile-shell">
          <section className="pos-hero purchase-hero">
            <div>
              <p className="pos-kicker">Compra rápida</p>
              <p>{filtered.length} productos · {selectedCategoryName} · Ingresa a {stockLocationLabelLower(stockLocation)}</p>
            </div>
            <div className="purchase-hero-actions">
              <Link href="/compras/historial" className="pos-icon-btn" aria-label="Historial de compras">
                <History size={17} />
              </Link>
              <button className="pos-icon-btn" type="button" onClick={() => load(true)} disabled={loading}>
                <RefreshCcw size={17} />
              </button>
            </div>
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

            <section className="pos-pre-price-bar compact purchase-info-bar">
              <div className="pos-pre-price-copy">
                <b>Compra de mercadería</b>
                <span>Editá el costo si el proveedor cambió el precio.</span>
              </div>
              <div className="purchase-total-chip">
                <small>Total</small>
                <b>{fmtMoney(total)}</b>
              </div>
            </section>

            <div className="pos-control-grid purchase-control-grid">
              <label>
                <span>Agregar a</span>
                <select value={stockLocation} onChange={(e) => setStockLocation(e.target.value as StockLocation)}>
                  <option value="LOCAL">Mayorista</option>
                  <option value="DEPOSITO">Minorista</option>
                </select>
              </label>
              <label>
                <span>Orden</span>
                <select value={sortMode} onChange={(e) => setSortMode(e.target.value as ProductSortMode)}>
                  <option value="name-asc">A-Z</option>
                  <option value="name-desc">Z-A</option>
                  <option value="category-asc">Categoría A-Z</option>
                  <option value="category-desc">Categoría Z-A</option>
                </select>
              </label>
            </div>

            <div className="pos-category-strip">
              <button type="button" className={!categoryId ? "active" : ""} onClick={() => setCategoryId("")}>Todos</button>
              {categories.map((category) => (
                <button key={category.id} type="button" className={categoryId === category.id ? "active" : ""} onClick={() => setCategoryId(category.id)}>{category.name}</button>
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
              <span className="pos-cart-fab-left"><ShoppingCart size={18} /><span><b>Compra</b><small>{cart.length ? `${cartUnits} item${cartUnits === 1 ? "" : "s"}` : "Tocar para abrir"}</small></span></span>
              <span className="pos-cart-fab-right"><b>{fmtMoney(total)}</b><small>Finalizar</small></span>
            </button>

            {cartOpen && (
              <div className="pos-cart-layer">
                <div className="pos-cart-sheet" role="dialog" aria-modal="true" aria-label="Compra">
                  <div className="pos-cart-handle" />
                  <header className="pos-cart-header">
                    <div><b>Compra de mercadería</b><span>{cart.length} productos · {fmtMoney(total)}</span></div>
                    <button type="button" className="pos-icon-btn" onClick={() => setCartOpen(false)}><X size={18} /></button>
                  </header>

                  <div className="pos-cart-scroll">
                    <div className="pos-mini-summary">
                      <span><Warehouse size={14} />{stockLocationLabel(stockLocation)}</span>
                      {changedCosts > 0 && <span className="warn">{changedCosts} costo{changedCosts === 1 ? "" : "s"} editado{changedCosts === 1 ? "" : "s"}</span>}
                    </div>

                    <div className="pos-cart-products">
                      {!cart.length && <div className="pos-empty compact"><ShoppingCart size={28} /><b>Compra vacía</b><span>Tocá productos para agregarlos en segundos.</span></div>}
                      {cart.map((item, index) => renderCartItem(item, true, `${cartLineKey(item)}-${index}`))}
                    </div>

                    <section className="pos-sale-options">
                      <details open>
                        <summary>Datos de compra</summary>
                        <div className="pos-option-body">
                          <label><span>Proveedor</span>
                            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                              <option value="">Sin proveedor</option>
                              {suppliers.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </label>
                          <label><span>Comprobante</span><input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Factura/remito" /></label>
                          <label><span>Fecha</span><input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></label>
                          <label><span>Método de pago</span><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>{methods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
                          <label><span>Observación</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" rows={3} /></label>
                        </div>
                      </details>
                    </section>
                  </div>

                  <footer className="pos-cart-footer">
                    <div className="pos-totals">
                      <div><span>Productos</span><b>{cart.length}</b></div>
                      <div className="total"><span>Total egreso</span><b>{fmtMoney(total)}</b></div>
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
                  <div><b>Apuntá al código de barras o QR</b><small>Cuando lo detecte, agrega el producto directo a la compra.</small></div>
                </div>
                <div className="pos-scanner-frame">
                  <div id={PURCHASE_SKU_SCANNER_ELEMENT_ID} className="pos-scanner-reader" />
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
        div[data-rht-toaster], div[data-rht-toaster] * { z-index: 2147483647 !important; }
        .modal-overlay { position: fixed; inset: 0; z-index: 2147483600 !important; display: flex; align-items: center; justify-content: center; padding: 18px; background: rgba(0,0,0,.48); overflow-y: auto; }
        .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; max-height: calc(100dvh - 36px); overflow: hidden; display: flex; flex-direction: column; }
        .modal-header, .modal-footer { padding: 14px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .modal-footer { border-top: 1px solid var(--border); border-bottom: 0; }
        .modal-body { padding: 16px; overflow-y: auto; }
        .full { width: 100%; justify-content: center; }
        .muted { color: var(--text3); }
        .small { font-size: 11px; }
        .danger { color: var(--danger) !important; }

        .pos-root { display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: 18px; }
        .pos-toolbar { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
        .pos-search { position: relative; flex: 1; min-width: 220px; }
        .pos-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text3); }
        .pos-search input { padding-left: 34px; width: 100%; }
        .pos-filter { width: 220px; }
        .pos-sort-filter { width: 185px; }
        .pos-scan-desktop-btn, .pos-refresh-btn, .pos-history-btn { height: 42px; white-space: nowrap; }
        .pos-pre-price-bar { margin-bottom: 14px; border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--border)); background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--surface)), var(--surface)); border-radius: 20px; padding: 12px; display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 12px; align-items: center; box-shadow: 0 14px 34px rgba(0,0,0,.12); }
        .pos-pre-price-copy { display: grid; gap: 3px; min-width: 0; }
        .pos-pre-price-copy b { font-size: 13px; color: var(--text); }
        .pos-pre-price-copy span { color: var(--text3); font-size: 12px; line-height: 1.35; }
        .purchase-total-chip { min-width: 170px; border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border)); background: var(--accent); color: white; border-radius: 16px; padding: 10px 12px; display: grid; gap: 2px; text-align: right; }
        .purchase-total-chip small { font-size: 10px; font-weight: 950; text-transform: uppercase; letter-spacing: .08em; opacity: .85; }
        .purchase-total-chip b { font-family: var(--mono); font-size: 17px; }
        .pos-pre-price-bar.compact { margin: 9px 0 10px; padding: 10px; border-radius: 18px; grid-template-columns: 1fr; gap: 9px; }
        .pos-pre-price-bar.compact .purchase-total-chip { width: 100%; min-width: 0; text-align: left; }
        .pos-products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
        .pos-product-card { min-height: 315px; padding: 12px; text-align: left; overflow: hidden; display: grid; gap: 8px; color: var(--text); }
        .pos-product-image { width: 100%; aspect-ratio: 1/1; border-radius: 14px; background: #fff; border: 1px solid var(--border); display: grid; place-items: center; overflow: hidden; padding: 8px; color: var(--text3); position: relative; }
        .pos-product-image img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .pos-product-meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 11px; font-weight: 800; }
        .pos-product-title { min-height: 38px; font-size: 14px; line-height: 1.25; }
        .pos-price-dual { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
        .pos-price-dual.purchase-single { grid-template-columns: 1fr; }
        .pos-price-dual button { border: 1px solid var(--border); border-radius: 12px; padding: 7px 8px; background: var(--surface2); display: grid; gap: 2px; min-width: 0; text-align: left; cursor: pointer; color: var(--text); }
        .pos-price-dual button.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 13%, var(--surface2)); }
        .pos-price-dual button:hover { border-color: var(--accent); transform: translateY(-1px); }
        .pos-price-dual button:disabled { opacity: .45; cursor: not-allowed; transform: none; }
        .pos-price-dual small { color: var(--text3); font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; }
        .pos-price-dual b { color: var(--accent); font-family: var(--mono); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pos-price-dual.compact { gap: 5px; }
        .pos-price-dual.compact button { padding: 5px 6px; border-radius: 10px; }
        .pos-price-dual.compact small { font-size: 8px; }
        .pos-price-dual.compact b { font-size: 10px; }
        .pos-card-cart-breakdown { width: fit-content; border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--border)); background: color-mix(in srgb, var(--accent) 8%, var(--surface2)); border-radius: 12px; padding: 6px 8px; display: grid; gap: 2px; font-size: 10px; line-height: 1.15; color: var(--text2); }
        .pos-card-cart-breakdown b { color: var(--text); font-size: 10px; font-family: inherit; }
        .pos-card-cart-breakdown span { color: var(--text2); font-size: 10px; font-weight: 800; }

        .pos-cart { padding: 0; align-self: start; position: sticky; top: 76px; max-height: calc(100vh - 96px); display: flex; flex-direction: column; overflow: hidden; }
        .pos-cart-body { padding: 16px; overflow: auto; flex: 1; }
        .pos-cart-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .pos-cart-head span { margin-left: auto; color: var(--text3); font-size: 12px; }
        .stock-badge { margin-bottom: 12px; display: inline-flex; align-items: center; gap: 6px; width: fit-content; }
        .purchase-cart-items { max-height: 360px !important; }
        .pos-cart-items { max-height: 260px; overflow: auto; margin-bottom: 12px; display: grid; gap: 8px; }
        .pos-cart-row, .pos-cart-item { display: grid; grid-template-columns: 52px minmax(0,1fr); gap: 10px; padding: 9px; border-radius: 18px; border: 1px solid var(--border); background: var(--surface); }
        .pos-cart-row { border-radius: 12px; border-left: 0; border-right: 0; border-top: 0; background: transparent; }
        .pos-cart-item-img { width: 52px; height: 52px; border-radius: 14px; background: white; border: 1px solid var(--border); display: grid; place-items: center; padding: 5px; overflow: hidden; color: var(--text3); }
        .pos-cart-item-img img, .pos-cart-preview img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .pos-cart-item-main { min-width: 0; display: grid; gap: 6px; }
        .pos-cart-item-title { display: flex; justify-content: space-between; gap: 8px; }
        .pos-cart-item-title strong { font-size: 13px; line-height: 1.2; }
        .pos-cart-item-title button { width: 30px; height: 30px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface2); color: var(--danger); display: grid; place-items: center; flex-shrink: 0; }
        .pos-cart-item-meta { display: flex; gap: 8px; flex-wrap: wrap; color: var(--text3); font-size: 11px; }
        .pos-cart-purchase-grid { display: grid; grid-template-columns: 126px minmax(0,1fr); gap: 8px; align-items: end; }
        .purchase-cost-input, .purchase-qty-input { display: grid; gap: 4px; }
        .purchase-cost-input span, .purchase-qty-input span { color: var(--text3); font-size: 10px; font-weight: 950; text-transform: uppercase; letter-spacing: .08em; }
        .purchase-cost-input input { height: 36px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface2); color: var(--text); padding: 0 10px; width: 100%; font-weight: 900; font-family: var(--mono); }
        .purchase-cost-warning { display: flex; gap: 6px; align-items: center; border: 1px solid rgba(245,158,11,.25); background: rgba(245,158,11,.09); color: var(--warn); border-radius: 12px; padding: 7px 8px; font-size: 11px; font-weight: 900; }
        .purchase-line-total { border-top: 1px solid var(--border); padding-top: 7px; }
        .purchase-line-total span { color: var(--text3); font-size: 11px; font-weight: 800; }
        .pos-cart-item-actions { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .pos-cart-item-actions > b { font-family: var(--mono); color: var(--accent); font-size: 13px; }
        .pos-stepper { display: inline-grid; grid-template-columns: 36px 36px 36px; align-items: center; overflow: hidden; border: 1px solid var(--border); border-radius: 14px; background: var(--surface2); }
        .pos-stepper button { height: 36px; border: 0; background: transparent; color: var(--text); display: grid; place-items: center; }
        .pos-stepper span { text-align: center; font-weight: 900; font-family: var(--mono); }
        .pos-kg-input { display: grid; grid-template-columns: 30px 90px; align-items: center; gap: 7px; }
        .pos-kg-input input { height: 36px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface2); color: var(--text); padding: 0 10px; width: 100%; }
        .pos-cart-footer { border-top: 1px solid var(--border); background: var(--surface); padding: 11px 12px max(12px, env(safe-area-inset-bottom)); box-shadow: 0 -18px 44px rgba(0,0,0,.32); }
        .desktop-footer { padding: 16px; }
        .pos-totals { display: grid; gap: 4px; margin-bottom: 10px; }
        .pos-totals > div { display: flex; justify-content: space-between; gap: 10px; color: var(--text2); font-size: 13px; }
        .pos-totals .total { color: var(--text); font-size: 20px; font-weight: 900; padding-top: 4px; }
        .pos-totals .total b { color: var(--accent); font-family: var(--mono); }
        .finish-btn { height: 48px; font-size: 15px; font-weight: 900; }

        .pos-mobile-only { display: none; }
        .pos-desktop-only { display: block; }
        .pos-mobile-shell { padding-bottom: 112px; }
        .pos-hero { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 16px; border: 1px solid var(--border); border-radius: 24px; background: radial-gradient(circle at top left, rgba(59,130,246,.2), transparent 34%), var(--surface); margin-bottom: 12px; }
        .purchase-hero { background: radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 22%, transparent), transparent 36%), var(--surface); }
        .purchase-hero-actions { display: flex; gap: 8px; align-items: center; }
        .pos-kicker, .pos-hero p { margin: 0; color: var(--text3); font-size: 12px; font-weight: 800; }
        .pos-icon-btn { width: 42px; height: 42px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface2); color: var(--text); display: inline-grid; place-items: center; flex-shrink: 0; }
        .pos-mobile-controls { position: sticky; top: 0; z-index: 15; padding: 10px 0 12px; background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(18px); }
        .pos-searchbox { display: grid; grid-template-columns: auto minmax(0,1fr) auto auto; align-items: center; gap: 9px; height: 48px; padding: 0 12px; border-radius: 18px; border: 1px solid var(--border); background: var(--surface); box-shadow: 0 10px 30px rgba(0,0,0,.16); }
        .pos-searchbox input { border: 0; background: transparent; outline: none; width: 100%; height: 100%; color: var(--text); font-size: 16px; }
        .pos-searchbox button, .pos-search-scan-btn { border: 0; background: var(--surface2); color: var(--text2); border-radius: 999px; width: 30px; height: 30px; display: grid; place-items: center; }
        .pos-search-scan-btn { color: var(--accent) !important; }
        .pos-control-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
        .pos-control-grid label, .pos-option-body label { display: grid; gap: 5px; min-width: 0; }
        .pos-control-grid span, .pos-option-body label > span { color: var(--text3); font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
        .pos-control-grid select, .pos-control-grid input, .pos-option-body select, .pos-option-body input, .pos-option-body textarea, .pos-kg-input input { min-width: 0; width: 100%; min-height: 42px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface); color: var(--text); padding: 0 10px; font-size: 14px; }
        .pos-option-body textarea { padding: 10px; min-height: 82px; }
        .pos-category-strip { display: flex; gap: 8px; overflow-x: auto; padding: 9px 1px 2px; scrollbar-width: none; }
        .pos-category-strip::-webkit-scrollbar { display: none; }
        .pos-category-strip button { border: 1px solid var(--border); background: var(--surface); color: var(--text2); border-radius: 999px; padding: 9px 12px; font-size: 12px; font-weight: 900; white-space: nowrap; }
        .pos-category-strip button.active { background: var(--accent); border-color: var(--accent); color: white; }
        .pos-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; }
        .pos-product { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 18px; padding: 7px; text-align: left; min-width: 0; box-shadow: 0 10px 24px rgba(0,0,0,.12); display: grid; gap: 7px; position: relative; overflow: hidden; touch-action: manipulation; }
        .pos-product:active { transform: scale(.98); }
        .pos-product-img { width: 100%; aspect-ratio: 1/1; border-radius: 14px; background: #fff; border: 1px solid var(--border); overflow: hidden; display: grid; place-items: center; padding: 4px; position: relative; color: var(--text3); }
        .pos-product-img img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .pos-added-pill { position: absolute; top: 5px; right: 5px; min-width: 25px; height: 25px; border-radius: 999px; background: var(--accent); color: white; display: grid; place-items: center; font-size: 11px; font-weight: 900; box-shadow: 0 10px 24px rgba(0,0,0,.22); }
        .pos-product-info { display: grid; gap: 3px; min-width: 0; }
        .pos-product-top { display: flex; justify-content: space-between; align-items: center; gap: 4px; font-size: 9px; color: var(--text3); font-weight: 900; text-transform: uppercase; }
        .pos-product strong { font-size: 12px; line-height: 1.15; min-height: 28px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .pos-product small { color: var(--text3); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pos-product b { font-family: var(--mono); color: var(--accent); font-size: 12px; }
        .pos-load-more, .pos-secondary-action { width: 100%; min-height: 44px; border-radius: 16px; border: 1px solid var(--border); background: var(--surface2); color: var(--text); display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 900; margin-top: 12px; }
        .pos-product-skeleton { min-height: 158px; border-radius: 18px; background: linear-gradient(90deg, var(--surface), var(--surface2), var(--surface)); animation: posPulse 1.2s infinite; }
        .pos-empty { min-height: 220px; border: 1px dashed var(--border); border-radius: 22px; display: grid; place-items: center; align-content: center; gap: 8px; color: var(--text3); text-align: center; padding: 20px; }
        .pos-empty b { color: var(--text); }
        .pos-empty.compact { min-height: 180px; }
        .pos-cart-fab { position: fixed; left: max(10px, env(safe-area-inset-left)); right: max(10px, env(safe-area-inset-right)); bottom: max(10px, env(safe-area-inset-bottom)); z-index: 2147483000; min-height: 66px; border: 1px solid rgba(255,255,255,.14); border-radius: 22px; background: color-mix(in srgb, var(--surface) 92%, black 8%); color: var(--text); box-shadow: 0 18px 50px rgba(0,0,0,.45); display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; backdrop-filter: blur(18px); }
        .pos-cart-fab-left { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
        .pos-cart-fab-left > span, .pos-cart-fab-right { display: grid; gap: 1px; text-align: left; }
        .pos-cart-fab small, .pos-cart-header span, .pos-help { color: var(--text3); font-size: 11px; }
        .pos-cart-fab-right { text-align: right; }
        .pos-cart-fab-right b { color: var(--accent); font-family: var(--mono); }
        .pos-cart-layer { position: fixed; inset: 0; z-index: 2147483001; background: rgba(0,0,0,.48); display: flex; align-items: flex-end; }
        .pos-cart-sheet { width: 100%; max-height: 94dvh; background: var(--bg); border-radius: 26px 26px 0 0; border: 1px solid var(--border); box-shadow: 0 -24px 70px rgba(0,0,0,.5); display: grid; grid-template-rows: auto auto minmax(0,1fr) auto; overflow: hidden; }
        .pos-cart-handle { width: 54px; height: 5px; border-radius: 999px; background: var(--border); margin: 9px auto 4px; }
        .pos-cart-header { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 8px 14px 12px; border-bottom: 1px solid var(--border); }
        .pos-cart-header > div { display: grid; gap: 2px; }
        .pos-cart-header b { font-size: 18px; }
        .pos-cart-scroll { overflow: auto; padding: 12px 12px 0; }
        .pos-mini-summary { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 10px; font-size: 12px; font-weight: 900; flex-wrap: wrap; }
        .pos-mini-summary span { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--border); background: var(--surface); color: var(--text2); border-radius: 999px; padding: 7px 9px; }
        .pos-mini-summary .warn { color: var(--warn); }
        .pos-cart-products { display: grid; gap: 8px; }
        .pos-sale-options { display: grid; gap: 8px; margin-top: 12px; padding-bottom: 12px; }
        .pos-sale-options details { border: 1px solid var(--border); border-radius: 18px; background: var(--surface); overflow: hidden; }
        .pos-sale-options summary { padding: 13px; font-weight: 900; cursor: pointer; }
        .pos-option-body { display: grid; gap: 10px; padding: 0 13px 13px; }
        .pos-cart-preview { position: fixed; right: 18px; bottom: max(88px, calc(env(safe-area-inset-bottom) + 88px)); z-index: 2147482999; display: flex; align-items: center; gap: 0; cursor: pointer; }
        .pos-cart-preview span, .pos-cart-preview b { width: 32px; height: 32px; border-radius: 999px; border: 2px solid var(--bg); background: white; color: var(--text); display: grid; place-items: center; overflow: hidden; margin-left: -8px; box-shadow: 0 8px 22px rgba(0,0,0,.25); font-size: 11px; }
        .pos-finish { width: 100%; min-height: 52px; border: 0; border-radius: 18px; background: var(--accent); color: white; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: 15px; font-weight: 950; }
        .pos-finish:disabled { opacity: .45; }

        .pos-confirm-modal, .pos-scanner-modal { width: min(520px, calc(100vw - 24px)); max-width: calc(100vw - 24px); border-radius: 20px; }
        .pos-confirm-footer { display: grid; grid-template-columns: 1fr; gap: 9px; }
        .pos-confirm-footer button { width: 100%; justify-content: center; }
        .confirm-box { display: flex; gap: 12px; align-items: flex-start; }
        .confirm-box p { color: var(--text2); font-size: 13px; line-height: 1.55; margin: 0; }
        .info-icon, .danger-icon { width: 38px; height: 38px; border-radius: 10px; background: var(--surface2); display: grid; place-items: center; flex-shrink: 0; color: var(--accent); }
        .danger-icon { background: rgba(239,68,68,.12); color: var(--danger); }
        .scanner-overlay { z-index: 2147483605 !important; }
        .pos-scanner-body { display: grid; gap: 12px; padding: 16px; }
        .pos-scanner-info { display: flex; gap: 10px; align-items: flex-start; border: 1px solid var(--border); border-radius: 14px; background: var(--surface2); padding: 12px; }
        .pos-scanner-info b { display: block; color: var(--text); font-size: 13px; line-height: 1.2; margin-bottom: 4px; }
        .pos-scanner-info small { display: block; color: var(--text3); font-size: 12px; line-height: 1.35; }
        .pos-scanner-frame { position: relative; min-height: 300px; overflow: hidden; border: 1px solid var(--border); border-radius: 16px; background: #000; }
        .pos-scanner-reader { width: 100%; min-height: 300px; }
        .pos-scanner-reader video { width: 100% !important; height: 300px !important; object-fit: cover !important; }
        .pos-scanner-loading { position: absolute; inset: 0; display: grid; place-items: center; align-content: center; gap: 10px; background: rgba(0,0,0,.72); color: white; z-index: 2; }
        .pos-scanner-loading p { margin: 0; font-size: 12px; font-weight: 800; }
        .pos-scanner-error { display: flex; gap: 8px; align-items: flex-start; border: 1px solid rgba(239,68,68,.28); border-radius: 13px; background: rgba(239,68,68,.1); color: var(--danger); padding: 10px 12px; font-size: 12px; line-height: 1.35; font-weight: 800; }
        .pos-scanner-note { margin: 0; color: var(--text3); font-size: 12px; line-height: 1.4; }

        @keyframes posPulse { 0%,100% { opacity: .65; } 50% { opacity: 1; } }

        @media (max-width: 1100px) { .pos-root { grid-template-columns: minmax(0,1fr) 380px; gap: 14px; } .pos-products-grid { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); } }
        @media (max-width: 900px) { .pos-root { grid-template-columns: 1fr; } .pos-cart { position: static; top: auto; max-height: none; order: -1; border-radius: 18px; } .pos-cart-body { max-height: none; overflow: visible; } .pos-cart-items { max-height: 280px; } }

        @media (max-width: 767px) {
          .pos-desktop-only { display: none !important; }
          .pos-mobile-only { display: block !important; }
          .pos-mobile-shell { padding-bottom: 124px !important; }
          .pos-pre-price-bar { grid-template-columns: 1fr; }
          .pos-scanner-modal { width: 100vw; max-width: 100vw; border-radius: 22px 22px 0 0; align-self: flex-end; }
          .pos-scanner-frame, .pos-scanner-reader { min-height: 340px; }
          .pos-scanner-reader video { height: 340px !important; }
          .modal-overlay { align-items: flex-end; padding: 0; }
        }
        @media (min-width: 768px) { .pos-mobile-only { display: none !important; } .pos-desktop-only { display: block !important; } }
        @media (min-width: 700px) { .pos-mobile-shell { max-width: 1180px; margin: 0 auto; } .pos-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; } .pos-product { padding: 10px; } .pos-product strong { font-size: 13px; } .pos-product b { font-size: 14px; } .pos-cart-fab { left: 50%; right: auto; transform: translateX(-50%); width: min(520px, calc(100vw - 28px)); } .pos-cart-sheet { width: min(560px, 100vw); margin: 0 auto; } .pos-cart-layer { justify-content: center; } }
        @media (max-width: 390px) { .pos-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } .pos-product { border-radius: 16px; } .pos-product strong { font-size: 11px; } .pos-product b { font-size: 11px; } .pos-cart-purchase-grid { grid-template-columns: 1fr; } }
      `}</style>
    </AppLayout>
  );
}
