/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import type { FinanceEntry, Product, Sale } from "@/types";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  X,
  Trophy,
  AlertTriangle,
  Tags,
  CalendarDays,
  Filter,
  RotateCcw,
  PackageCheck,
  HandCoins,
  ReceiptText,
  Percent,
  Search,
  ArrowUpDown,
  BadgeDollarSign,
  Eye,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  compareDateInputsAR,
  endOfDayAR,
  firstDayOfCurrentMonthAR,
  formatDateAR,
  formatDateTimeAR,
  formatShortDateAR,
  startOfDayAR,
  todayInputAR,
} from "@/lib/dateAR";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

const pct = (n: number | null | undefined) => {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  return `${Number(n).toFixed(1)}%`;
};

const MOVEMENTS_PAGE_SIZE = 5;
const MOBILE_MARGIN_PAGE_SIZE = 6;

type AnyObj = Record<string, any>;
type FinanceMobileTab = "resumen" | "margenes" | "movimientos";
type SalesScope = "ALL" | "LOCAL" | "DEPOSITO";

type SalesLocationSummary = {
  label: string;
  salesCount: number;
  itemsCount: number;
  total: number;
  cost: number;
  grossProfit: number;
  margin: number;
};

type SalesByLocationStats = {
  all: SalesLocationSummary;
  LOCAL: SalesLocationSummary;
  DEPOSITO: SalesLocationSummary;
};

type StatsState = {
  week: number;
  month: number;
  year: number;
};

type FinanceForm = {
  type: "INGRESO" | "EGRESO";
  amount: string;
  description: string;
  category: string;
  date: string;
};

type MarginRow = {
  id: string;
  name: string;
  sku?: string | null;
  saleUnit: Product["saleUnit"];
  category: string;
  cost: number;
  retailPrice: number;
  wholesalePrice: number;
  retailProfit: number | null;
  wholesaleProfit: number | null;
  retailMargin: number | null;
  wholesaleMargin: number | null;
};

type MarginSort =
  | "name"
  | "cost"
  | "retailMargin"
  | "wholesaleMargin"
  | "retailProfit"
  | "wholesaleProfit";

type MovementLinkedRef = {
  type: "sale" | "purchase";
  id: string;
};

const FINANCE_CATEGORIES = [
  { value: "VENTA", label: "Venta" },
  { value: "COBRANZA", label: "Cobranza" },
  { value: "AlquilerL1", label: "Alquiler Local 1" },
  { value: "AlquilerF1", label: "Alquiler Fábrica / Fondo 1" },
  { value: "Alarma", label: "Alarma" },
  { value: "Sueldos", label: "Sueldos" },
  { value: "MateriaPrima", label: "Materia prima" },
  { value: "Impuestos", label: "Impuestos" },
  { value: "VEP", label: "VEP" },
  { value: "Contadora", label: "Contadora" },
  { value: "Arca", label: "ARCA" },
  { value: "Eenvios", label: "Envíos" },
  { value: "Publicidad", label: "Publicidad" },
  { value: "Otro", label: "Otro" },
];

const SALES_SCOPE_OPTIONS: {
  value: SalesScope;
  label: string;
  description: string;
}[] = [
  {
    value: "ALL",
    label: "Combinada",
    description: "Mayorista + Minorista",
  },
  {
    value: "LOCAL",
    label: "Mayorista",
    description: "Stock LOCAL",
  },
  {
    value: "DEPOSITO",
    label: "Minorista",
    description: "Stock DEPÓSITO",
  },
];

const today = todayInputAR;
const firstDayOfCurrentMonth = firstDayOfCurrentMonthAR;
const startOfDay = startOfDayAR;
const endOfDay = endOfDayAR;

const categoryLabel = (value?: string | null) => {
  if (!value) return "—";
  return FINANCE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
};

const emptySalesLocationSummary = (label: string): SalesLocationSummary => ({
  label,
  salesCount: 0,
  itemsCount: 0,
  total: 0,
  cost: 0,
  grossProfit: 0,
  margin: 0,
});

const EMPTY_SALES_BY_LOCATION_STATS: SalesByLocationStats = {
  all: emptySalesLocationSummary("Combinada"),
  LOCAL: emptySalesLocationSummary("Mayorista"),
  DEPOSITO: emptySalesLocationSummary("Minorista"),
};

const normalizeArray = <T,>(data: any): T[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const normalizeAmount = (data: any): number => {
  if (typeof data === "number") return data;
  if (typeof data?.total === "number") return data.total;
  if (typeof data?.amount === "number") return data.amount;
  if (typeof data?.income === "number") return data.income;
  if (typeof data?.totalIncome === "number") return data.totalIncome;
  if (typeof data?._sum?.amount === "number") return data._sum.amount;
  return 0;
};

const normalizeSalesLocationSummary = (
  value: AnyObj | null | undefined,
  fallbackLabel: string,
): SalesLocationSummary => ({
  label: String(value?.label ?? fallbackLabel),
  salesCount: Number(value?.salesCount ?? 0),
  itemsCount: Number(value?.itemsCount ?? 0),
  total: Number(value?.total ?? 0),
  cost: Number(value?.cost ?? 0),
  grossProfit: Number(value?.grossProfit ?? 0),
  margin: Number(value?.margin ?? 0),
});

const normalizeSalesByLocationStats = (
  data: AnyObj | null | undefined,
): SalesByLocationStats => ({
  all: normalizeSalesLocationSummary(data?.all, "Combinada"),
  LOCAL: normalizeSalesLocationSummary(data?.LOCAL, "Mayorista"),
  DEPOSITO: normalizeSalesLocationSummary(data?.DEPOSITO, "Minorista"),
});

const getPartsFromDate = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);

  return {
    year,
    month,
    day,
  };
};

const getProductName = (p: AnyObj) =>
  p.name ??
  p.productName ??
  p.productNameSnapshot ??
  p.product?.name ??
  p.product?.title ??
  p.title ??
  "Producto";

const getProductQty = (p: AnyObj) =>
  Number(
    p.quantity ??
      p.totalSold ??
      p.totalQuantity ??
      p.sold ??
      p._sum?.quantity ??
      p._sum?.quantityKg ??
      0,
  );

const getItemQuantity = (item: AnyObj) => {
  const quantityKg = Number(item.quantityKg || 0);
  if (quantityKg > 0) return quantityKg;

  const quantity = Number(item.quantity || 0);
  return quantity > 0 ? quantity : 1;
};

const getSaleItemCost = (item: AnyObj) => {
  const qty = getItemQuantity(item);
  return Number(item.purchasePriceSnapshot || 0) * qty;
};

const getSaleCost = (sale: Sale) => {
  return (sale.items || []).reduce((acc, item) => {
    return acc + getSaleItemCost(item as AnyObj);
  }, 0);
};

const getSaleProfit = (sale: Sale) => {
  if (typeof sale.grossProfit === "number") {
    return Number(sale.grossProfit || 0);
  }

  const total = Number(sale.total || 0);
  const cost = getSaleCost(sale);

  return total - cost;
};

const getSaleDate = (sale: Sale) => new Date(sale.createdAt);

const getProductCategoryName = (product: Product) => {
  if (!product.category) return "Sin categoría";
  if (typeof product.category === "string") return product.category;
  return product.category.name || "Sin categoría";
};

const getProductCost = (product: Product) => Number(product.purchasePrice || 0);

const getProductRetailPrice = (product: Product) => {
  if (product.saleUnit === "KG") {
    return Number(product.pricePerKg ?? product.price ?? 0);
  }

  return Number(product.price || 0);
};

const getProductWholesalePrice = (product: Product) => {
  if (product.saleUnit === "KG") {
    return Number(
      product.wholesalePricePerKg ??
        product.wholesalePrice ??
        product.pricePerKg ??
        product.price ??
        0,
    );
  }

  return Number(product.wholesalePrice ?? product.price ?? 0);
};

const getPriceProfit = (price: number, cost: number): number | null => {
  if (cost <= 0 || price <= 0) return null;
  return price - cost;
};

const getPriceProfitPercent = (price: number, cost: number): number | null => {
  const profit = getPriceProfit(price, cost);
  if (profit === null) return null;
  return (profit / price) * 100;
};

const getProfitColor = (value: number | null) => {
  if (value === null) return "var(--text2)";
  if (value > 0) return "var(--accent)";
  if (value < 0) return "var(--danger)";
  return "var(--text2)";
};

const getMarginBadgeClass = (value: number | null) => {
  if (value === null) return "badge-gray";
  if (value > 0) return "badge-green";
  if (value < 0) return "badge-red";
  return "badge-gray";
};

const fmtOptional = (value: number | null) => {
  if (value === null) return "—";
  return fmt(value);
};

const formatDateTime = (value?: string | Date | null) => formatDateTimeAR(value);
const formatDateOnly = (value?: string | Date | null) => formatDateAR(value);

const getMovementLinkedRef = (
  movement?: AnyObj | null,
): MovementLinkedRef | null => {
  if (!movement) return null;

  const saleId =
    movement.saleId ??
    movement.sale?.id ??
    movement.sale?.saleId ??
    movement.referenceSaleId;

  if (saleId) return { type: "sale", id: String(saleId) };

  const purchaseId =
    movement.purchaseId ??
    movement.purchase?.id ??
    movement.purchase?.purchaseId ??
    movement.referencePurchaseId;

  if (purchaseId) return { type: "purchase", id: String(purchaseId) };

  const description = String(movement.description || "");
  const saleMatch = description.match(/\[sale:([a-zA-Z0-9-]+)\]/i);
  if (saleMatch?.[1]) return { type: "sale", id: saleMatch[1] };

  const purchaseMatch = description.match(/\[purchase:([a-zA-Z0-9-]+)\]/i);
  if (purchaseMatch?.[1]) return { type: "purchase", id: purchaseMatch[1] };

  return null;
};

const getCleanMovementDescription = (movement?: AnyObj | null) => {
  const description = String(movement?.description || "").trim();
  return description
    .replace(/\[sale:[a-zA-Z0-9-]+\]\s*/i, "")
    .replace(/\[purchase:[a-zA-Z0-9-]+\]\s*/i, "")
    .trim();
};

const getLinkedMovementTotal = (
  detail?: AnyObj | null,
  movement?: AnyObj | null,
) => {
  const value =
    detail?.total ??
    detail?.totalAmount ??
    detail?.amount ??
    detail?.finalTotal ??
    detail?.grandTotal ??
    detail?.totalCost ??
    detail?.purchaseTotal ??
    detail?.subtotal ??
    movement?.amount;

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const getLinkedPaymentLabel = (detail?: AnyObj | null) => {
  if (!detail) return "—";

  if (Array.isArray(detail.payments) && detail.payments.length > 0) {
    return detail.payments
      .map((payment: AnyObj) => payment.method || payment.paymentMethod || "Pago")
      .join(" + ");
  }

  return (
    detail.paymentMethod ??
    detail.paymentType ??
    detail.paymentMethodSnapshot ??
    detail.paymentCondition ??
    detail.condition ??
    detail.method ??
    "—"
  );
};

const getSaleClientName = (sale?: AnyObj | null) => {
  if (!sale) return "—";

  const clientName = [sale.client?.nombre, sale.client?.apellido]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    clientName ||
    sale.client?.name ||
    sale.clientNameSnapshot ||
    sale.customerNameSnapshot ||
    sale.client?.gmail ||
    "Consumidor final"
  );
};

const getPurchaseSupplierName = (purchase?: AnyObj | null) => {
  if (!purchase) return "—";

  return (
    purchase.supplier?.name ??
    purchase.supplier?.nombre ??
    purchase.provider?.name ??
    purchase.provider?.nombre ??
    purchase.proveedor?.name ??
    purchase.proveedor?.nombre ??
    purchase.vendor?.name ??
    purchase.vendor?.nombre ??
    purchase.supplierNameSnapshot ??
    purchase.providerName ??
    purchase.providerNameSnapshot ??
    purchase.proveedorNameSnapshot ??
    purchase.supplierSnapshot?.name ??
    purchase.supplierSnapshot?.nombre ??
    purchase.providerSnapshot?.name ??
    purchase.providerSnapshot?.nombre ??
    purchase.supplierName ??
    purchase.providerName ??
    purchase.proveedorName ??
    "—"
  );
};

const getLinkedMovementItems = (
  detail?: AnyObj | null,
  type?: MovementLinkedRef["type"],
): AnyObj[] => {
  if (!detail) return [];

  const candidates =
    type === "purchase"
      ? [
          detail.items,
          detail.purchaseItems,
          detail.products,
          detail.purchaseProducts,
          detail.details,
          detail.lines,
          detail.stockMovements,
        ]
      : [
          detail.items,
          detail.saleItems,
          detail.products,
          detail.saleProducts,
          detail.details,
          detail.lines,
        ];

  const items = candidates.find((candidate) => Array.isArray(candidate));
  return Array.isArray(items) ? items : [];
};

const getLinkedItemName = (item?: AnyObj | null) => {
  if (!item) return "Producto";

  return (
    item.productNameSnapshot ??
    item.productName ??
    item.name ??
    item.title ??
    item.product?.name ??
    item.product?.title ??
    item.component?.name ??
    item.item?.name ??
    "Producto"
  );
};

const getLinkedItemSku = (item?: AnyObj | null) => {
  if (!item) return "";

  return String(
    item.productSkuSnapshot ??
      item.sku ??
      item.product?.sku ??
      item.component?.sku ??
      "",
  );
};

const getLinkedItemQuantityNumber = (item?: AnyObj | null) => {
  if (!item) return 0;

  const quantityKg = Number(
    item.quantityKg ?? item.kg ?? item.totalKg ?? item.productQuantityKg ?? 0,
  );

  if (Number.isFinite(quantityKg) && quantityKg > 0) return quantityKg;

  const quantity = Number(
    item.quantity ??
      item.qty ??
      item.units ??
      item.totalQuantity ??
      item.productQuantity ??
      0,
  );

  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
};

const getLinkedItemQuantityLabel = (item?: AnyObj | null) => {
  if (!item) return "—";

  const quantityKg = Number(
    item.quantityKg ?? item.kg ?? item.totalKg ?? item.productQuantityKg ?? 0,
  );

  if (Number.isFinite(quantityKg) && quantityKg > 0) {
    return `${quantityKg.toLocaleString("es-AR", {
      maximumFractionDigits: 3,
    })} kg`;
  }

  const quantity = getLinkedItemQuantityNumber(item);
  return quantity.toLocaleString("es-AR", { maximumFractionDigits: 3 });
};

const getLinkedItemUnitPrice = (item?: AnyObj | null) => {
  if (!item) return 0;

  const value =
    item.price ??
    item.unitPrice ??
    item.costPrice ??
    item.purchasePrice ??
    item.purchasePriceSnapshot ??
    item.unitCost ??
    item.cost ??
    item.product?.purchasePrice ??
    item.product?.price;

  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const getLinkedItemSubtotal = (item?: AnyObj | null) => {
  if (!item) return 0;

  const value =
    item.subtotal ??
    item.total ??
    item.lineTotal ??
    item.totalPrice ??
    item.totalCost ??
    item.amount;

  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return n;

  return getLinkedItemUnitPrice(item) * getLinkedItemQuantityNumber(item);
};

const sortNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return Number.NEGATIVE_INFINITY;
  }

  return Number(value);
};

export default function FinanzasPage() {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<FinanceEntry | null>(null);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<AnyObj | null>(null);

  const [dateFrom, setDateFrom] = useState(firstDayOfCurrentMonth());
  const [dateTo, setDateTo] = useState(today());

  const [marginSearch, setMarginSearch] = useState("");
  const [marginSort, setMarginSort] = useState<MarginSort>("retailMargin");
  const [incomeMovementsPage, setIncomeMovementsPage] = useState(1);
  const [expenseMovementsPage, setExpenseMovementsPage] = useState(1);
  const [marginPage, setMarginPage] = useState(1);
  const [mobileTab, setMobileTab] = useState<FinanceMobileTab>("resumen");
  const [salesScope, setSalesScope] = useState<SalesScope>("ALL");
  const [salesByLocationStats, setSalesByLocationStats] =
    useState<SalesByLocationStats>(EMPTY_SALES_BY_LOCATION_STATS);

  const [stats, setStats] = useState<StatsState>({
    week: 0,
    month: 0,
    year: 0,
  });

  const [categoryStats, setCategoryStats] = useState<AnyObj[]>([]);
  const [topProducts, setTopProducts] = useState<AnyObj[]>([]);
  const [worstProducts, setWorstProducts] = useState<AnyObj[]>([]);

  const [form, setForm] = useState<FinanceForm>({
    type: "INGRESO",
    amount: "",
    description: "",
    category: "Otro",
    date: today(),
  });

  const selectedMovementData = selectedMovement as AnyObj | null;

  const selectedMovementLink = useMemo(() => {
    return getMovementLinkedRef(selectedMovementData);
  }, [selectedMovementData]);

  const selectedMovementLinkedDetail = useMemo(() => {
    if (!selectedMovementData || !selectedMovementLink) return null;

    if (
      selectedSaleDetail?.id &&
      String(selectedSaleDetail.id) === selectedMovementLink.id
    ) {
      return selectedSaleDetail;
    }

    if (selectedMovementLink.type === "sale") {
      const embeddedSale = selectedMovementData.sale as AnyObj | undefined;
      if (embeddedSale?.id) return embeddedSale;

      const localSale = sales.find(
        (sale) => String(sale.id) === selectedMovementLink.id,
      ) as AnyObj | undefined;

      if (localSale) return localSale;
    }

    if (selectedMovementLink.type === "purchase") {
      const embeddedPurchase = selectedMovementData.purchase as AnyObj | undefined;
      if (embeddedPurchase?.id) return embeddedPurchase;
    }

    return {
      id: selectedMovementLink.id,
    };
  }, [selectedMovementData, selectedMovementLink, selectedSaleDetail, sales]);

  const selectedMovementSale =
    selectedMovementLink?.type === "sale" ? selectedMovementLinkedDetail : null;

  const selectedMovementPurchase =
    selectedMovementLink?.type === "purchase" ? selectedMovementLinkedDetail : null;

  const selectedLinkedItems = useMemo(() => {
    return getLinkedMovementItems(
      selectedMovementLinkedDetail,
      selectedMovementLink?.type,
    );
  }, [selectedMovementLinkedDetail, selectedMovementLink?.type]);

  useEffect(() => {
    let alive = true;

    const loadLinkedDetail = async () => {
      if (!selectedMovementData) {
        setSelectedSaleDetail(null);
        return;
      }

      const linkedRef = getMovementLinkedRef(selectedMovementData);
      if (!linkedRef) {
        setSelectedSaleDetail(null);
        return;
      }

      if (linkedRef.type === "sale") {
        const embeddedSale = selectedMovementData.sale as AnyObj | undefined;
        if (embeddedSale?.id) {
          setSelectedSaleDetail(embeddedSale);
          return;
        }

        const localSale = sales.find((sale) => String(sale.id) === linkedRef.id) as
          | AnyObj
          | undefined;

        if (localSale) {
          setSelectedSaleDetail(localSale);
          return;
        }
      }

      if (linkedRef.type === "purchase") {
        const embeddedPurchase = selectedMovementData.purchase as AnyObj | undefined;
        if (embeddedPurchase?.id) {
          setSelectedSaleDetail(embeddedPurchase);
          return;
        }
      }

      const urls =
        linkedRef.type === "sale"
          ? [`/sales/${linkedRef.id}`]
          : [`/purchases/${linkedRef.id}`, `/compras/${linkedRef.id}`];

      for (const url of urls) {
        try {
          const res = await api.get(url);
          const detail =
            res.data?.content ??
            res.data?.sale ??
            res.data?.purchase ??
            res.data?.compra ??
            res.data;

          if (!alive) return;

          if (detail?.id) {
            setSelectedSaleDetail(detail);
            return;
          }
        } catch {
          // Probamos el siguiente endpoint posible.
        }
      }

      if (!alive) return;
      setSelectedSaleDetail({ id: linkedRef.id });
    };

    loadLinkedDetail();

    return () => {
      alive = false;
    };
  }, [selectedMovementData, sales]);

  const safeGet = async <T,>(
    url: string,
    fallback: T,
    params?: AnyObj,
  ): Promise<T> => {
    try {
      const res = await api.get(url, { params });
      return res.data;
    } catch {
      return fallback;
    }
  };

  const load = async () => {
    setLoading(true);

    try {
      const selected = getPartsFromDate(dateTo);

      const [
        financeData,
        salesData,
        productsData,
        weekData,
        monthData,
        yearData,
        categoryData,
        salesByLocationData,
        topProductsData,
        worstProductsData,
      ] = await Promise.all([
        safeGet<any>("/finance", []),
        safeGet<any>("/sales", []),
        safeGet<any>("/products", []),
        safeGet<any>("/finance/income/week", 0, {
          year: selected.year,
          month: selected.month,
          day: selected.day,
        }),
        safeGet<any>("/finance/income/month", 0, {
          year: selected.year,
          month: selected.month,
        }),
        safeGet<any>("/finance/income/year", 0, {
          year: selected.year,
        }),
        safeGet<any>("/finance/income/category", [], {
          from: dateFrom,
          to: dateTo,
        }),
        safeGet<any>(
          "/finance/sales/by-stock-location",
          EMPTY_SALES_BY_LOCATION_STATS,
          {
            from: dateFrom,
            to: dateTo,
          },
        ),
        safeGet<any>("/finance/products/top-range", [], {
          from: dateFrom,
          to: dateTo,
          limit: 5,
          stockLocation: salesScope,
        }),
        safeGet<any>("/finance/products/worst-range", [], {
          from: dateFrom,
          to: dateTo,
          limit: 5,
          stockLocation: salesScope,
        }),
      ]);

      setEntries(normalizeArray<FinanceEntry>(financeData));
      setSales(normalizeArray<Sale>(salesData));
      setProducts(normalizeArray<Product>(productsData));

      setStats({
        week: normalizeAmount(weekData),
        month: normalizeAmount(monthData),
        year: normalizeAmount(yearData),
      });

      setCategoryStats(normalizeArray<AnyObj>(categoryData));
      setSalesByLocationStats(normalizeSalesByLocationStats(salesByLocationData));
      setTopProducts(normalizeArray<AnyObj>(topProductsData));
      setWorstProducts(normalizeArray<AnyObj>(worstProductsData));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesScope]);

  const filteredEntries = useMemo(() => {
    const from = startOfDay(dateFrom);
    const to = endOfDay(dateTo);

    return entries.filter((e) => {
      const date = new Date(e.date);
      return date >= from && date <= to;
    });
  }, [entries, dateFrom, dateTo]);

  const filteredSales = useMemo(() => {
    const from = startOfDay(dateFrom);
    const to = endOfDay(dateTo);

    return sales.filter((sale) => {
      const date = getSaleDate(sale);
      return date >= from && date <= to && sale.status !== "CANCELLED";
    });
  }, [sales, dateFrom, dateTo]);

  const filteredSalesByScope = useMemo(() => {
    if (salesScope === "ALL") return filteredSales;

    return filteredSales.filter((sale) => {
      return (sale as AnyObj).stockLocation === salesScope;
    });
  }, [filteredSales, salesScope]);

  const fallbackSalesStats = useMemo<SalesLocationSummary>(() => {
    const total = filteredSalesByScope.reduce(
      (acc, sale) => acc + Number(sale.total || 0),
      0,
    );

    const cost = filteredSalesByScope.reduce(
      (acc, sale) => acc + getSaleCost(sale),
      0,
    );

    const grossProfit = filteredSalesByScope.reduce(
      (acc, sale) => acc + getSaleProfit(sale),
      0,
    );

    return {
      label:
        SALES_SCOPE_OPTIONS.find((option) => option.value === salesScope)?.label ??
        "Combinada",
      salesCount: filteredSalesByScope.length,
      itemsCount: filteredSalesByScope.reduce(
        (acc, sale) => acc + Number((sale.items || []).length || 0),
        0,
      ),
      total,
      cost,
      grossProfit,
      margin: total > 0 ? (grossProfit / total) * 100 : 0,
    };
  }, [filteredSalesByScope, salesScope]);

  const selectedSalesStats = useMemo(() => {
    const backendStats =
      salesScope === "ALL"
        ? salesByLocationStats.all
        : salesByLocationStats[salesScope];

    const backendHasData =
      backendStats.salesCount > 0 ||
      backendStats.total > 0 ||
      backendStats.cost > 0 ||
      backendStats.grossProfit > 0;

    if (backendHasData || fallbackSalesStats.salesCount === 0) {
      return backendStats;
    }

    return fallbackSalesStats;
  }, [fallbackSalesStats, salesByLocationStats, salesScope]);

  const selectedSalesScopeLabel =
    SALES_SCOPE_OPTIONS.find((option) => option.value === salesScope)?.label ??
    "Combinada";

  const selectedSalesScopeDescription =
    SALES_SCOPE_OPTIONS.find((option) => option.value === salesScope)?.description ??
    "Mayorista + Minorista";

  useEffect(() => {
    setIncomeMovementsPage(1);
    setExpenseMovementsPage(1);
  }, [dateFrom, dateTo, entries.length]);

  const recentEntries = useMemo(() => {
    return [...filteredEntries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [filteredEntries]);

  const recentIncomeEntries = useMemo(() => {
    return recentEntries.filter((entry) => entry.type === "INGRESO");
  }, [recentEntries]);

  const recentExpenseEntries = useMemo(() => {
    return recentEntries.filter((entry) => entry.type === "EGRESO");
  }, [recentEntries]);

  const totalIncomeMovementPages = Math.max(
    1,
    Math.ceil(recentIncomeEntries.length / MOVEMENTS_PAGE_SIZE),
  );

  const totalExpenseMovementPages = Math.max(
    1,
    Math.ceil(recentExpenseEntries.length / MOVEMENTS_PAGE_SIZE),
  );

  const currentIncomeMovementPage = Math.min(
    incomeMovementsPage,
    totalIncomeMovementPages,
  );

  const currentExpenseMovementPage = Math.min(
    expenseMovementsPage,
    totalExpenseMovementPages,
  );

  const paginatedIncomeEntries = useMemo(() => {
    const start = (currentIncomeMovementPage - 1) * MOVEMENTS_PAGE_SIZE;
    return recentIncomeEntries.slice(start, start + MOVEMENTS_PAGE_SIZE);
  }, [recentIncomeEntries, currentIncomeMovementPage]);

  const paginatedExpenseEntries = useMemo(() => {
    const start = (currentExpenseMovementPage - 1) * MOVEMENTS_PAGE_SIZE;
    return recentExpenseEntries.slice(start, start + MOVEMENTS_PAGE_SIZE);
  }, [recentExpenseEntries, currentExpenseMovementPage]);

  const marginRows = useMemo<MarginRow[]>(() => {
    return products
      .filter((product) => product.isActive !== false)
      .map((product) => {
        const cost = getProductCost(product);
        const retailPrice = getProductRetailPrice(product);
        const wholesalePrice = getProductWholesalePrice(product);
        const retailProfit = getPriceProfit(retailPrice, cost);
        const wholesaleProfit = getPriceProfit(wholesalePrice, cost);

        return {
          id: product.id,
          name: product.name,
          sku: product.sku,
          saleUnit: product.saleUnit,
          category: getProductCategoryName(product),
          cost,
          retailPrice,
          wholesalePrice,
          retailProfit,
          wholesaleProfit,
          retailMargin: getPriceProfitPercent(retailPrice, cost),
          wholesaleMargin: getPriceProfitPercent(wholesalePrice, cost),
        };
      });
  }, [products]);

  const filteredMarginRows = useMemo(() => {
    const q = marginSearch.trim().toLowerCase();

    const rows = marginRows.filter((row) => {
      if (!q) return true;

      return (
        row.name.toLowerCase().includes(q) ||
        String(row.sku || "")
          .toLowerCase()
          .includes(q) ||
        row.category.toLowerCase().includes(q)
      );
    });

    return [...rows].sort((a, b) => {
      if (marginSort === "name") return a.name.localeCompare(b.name);

      return (
        sortNumber(b[marginSort] as number | null) -
        sortNumber(a[marginSort] as number | null)
      );
    });
  }, [marginRows, marginSearch, marginSort]);

  const totalMarginPages = Math.max(
    1,
    Math.ceil(filteredMarginRows.length / MOBILE_MARGIN_PAGE_SIZE),
  );

  const currentMarginPage = Math.min(marginPage, totalMarginPages);

  const paginatedMarginRows = useMemo(() => {
    const start = (currentMarginPage - 1) * MOBILE_MARGIN_PAGE_SIZE;
    return filteredMarginRows.slice(start, start + MOBILE_MARGIN_PAGE_SIZE);
  }, [filteredMarginRows, currentMarginPage]);

  const marginSummary = useMemo(() => {
    const rowsWithRetailMargin = marginRows.filter(
      (row) => row.retailMargin !== null,
    );
    const rowsWithWholesaleMargin = marginRows.filter(
      (row) => row.wholesaleMargin !== null,
    );

    return {
      avgRetailMargin: rowsWithRetailMargin.length
        ? rowsWithRetailMargin.reduce(
            (acc, row) => acc + Number(row.retailMargin || 0),
            0,
          ) / rowsWithRetailMargin.length
        : null,
      avgWholesaleMargin: rowsWithWholesaleMargin.length
        ? rowsWithWholesaleMargin.reduce(
            (acc, row) => acc + Number(row.wholesaleMargin || 0),
            0,
          ) / rowsWithWholesaleMargin.length
        : null,
      productsWithoutCost: marginRows.filter((row) => row.cost <= 0).length,
    };
  }, [marginRows]);

  const ingresos = useMemo(
    () =>
      filteredEntries
        .filter((e) => e.type === "INGRESO")
        .reduce((a, e) => a + Number(e.amount || 0), 0),
    [filteredEntries],
  );

  const egresos = useMemo(
    () =>
      filteredEntries
        .filter((e) => e.type === "EGRESO")
        .reduce((a, e) => a + Number(e.amount || 0), 0),
    [filteredEntries],
  );

  const ventasFacturadas = selectedSalesStats.total;
  const costoVendido = selectedSalesStats.cost;
  const utilidadBruta = selectedSalesStats.grossProfit;
  const margenBruto = selectedSalesStats.margin;

  const balance = ingresos - egresos;
  const resultadoEstimado = utilidadBruta - egresos;

  const chartData = useMemo(() => {
    const map: Record<
      string,
      { date: string; ingresos: number; egresos: number; utilidad: number }
    > = {};

    filteredEntries.forEach((e) => {
      const d = formatShortDateAR(e.date);

      if (!map[d]) {
        map[d] = {
          date: d,
          ingresos: 0,
          egresos: 0,
          utilidad: 0,
        };
      }

      if (e.type === "INGRESO") {
        map[d].ingresos += Number(e.amount || 0);
      } else {
        map[d].egresos += Number(e.amount || 0);
      }
    });

    filteredSalesByScope.forEach((sale) => {
      const d = formatShortDateAR(sale.createdAt);

      if (!map[d]) {
        map[d] = {
          date: d,
          ingresos: 0,
          egresos: 0,
          utilidad: 0,
        };
      }

      map[d].utilidad += getSaleProfit(sale);
    });

    return Object.values(map);
  }, [filteredEntries, filteredSalesByScope]);

  const filteredWorstProducts = useMemo(() => {
    const topNames = new Set(
      topProducts.map((p) => getProductName(p).toLowerCase().trim()),
    );

    return worstProducts.filter((p) => {
      const name = getProductName(p).toLowerCase().trim();
      return !topNames.has(name);
    });
  }, [topProducts, worstProducts]);

  const field = (k: keyof FinanceForm, v: string) => {
    setForm((p) => ({
      ...p,
      [k]: v,
    }));
  };

  const openCreate = () => {
    setForm({
      type: "INGRESO",
      amount: "",
      description: "",
      category: "Otro",
      date: today(),
    });

    setModal(true);
  };

  const resetDates = async () => {
    setDateFrom(firstDayOfCurrentMonth());
    setDateTo(today());

    setTimeout(() => {
      load();
    }, 0);
  };

  const applyFilters = async () => {
    if (!dateFrom || !dateTo) {
      alert("Seleccioná desde y hasta");
      return;
    }

    if (compareDateInputsAR(dateFrom, dateTo) > 0) {
      alert("La fecha desde no puede ser mayor a la fecha hasta");
      return;
    }

    await load();
  };

  const handleSave = async () => {
    const amount = Number(form.amount);

    if (!amount || amount <= 0) {
      alert("Ingresá un importe válido");
      return;
    }

    if (!form.description.trim()) {
      alert("Ingresá una descripción");
      return;
    }

    setSaving(true);

    try {
      await api.post("/finance", {
        type: form.type,
        amount,
        description: form.description.trim(),
        category: form.category || "Otro",
        date: form.date,
      });

      setModal(false);
      await load();
    } catch (error: any) {
      alert(
        error?.response?.data?.error ||
          "Error guardando el movimiento financiero",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout
      title="Finanzas"
      subtitle={`Movimientos desde ${dateFrom} hasta ${dateTo}`}
      actions={
        <div
          className="finance-actions"
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} /> Nueva entrada
          </button>
        </div>
      }
    >
      <div
        className={`finance-page finance-tab-${mobileTab}`}
        style={{ minWidth: 0, maxWidth: "100%" }}
      >
        <div
          className="card finance-filter-card"
          style={{ padding: 16, marginBottom: 14 }}
        >
          <div
            className="finance-filter-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr)) auto auto",
              gap: 12,
              alignItems: "end",
            }}
          >
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Desde</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Hasta</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <button className="btn btn-primary" onClick={applyFilters}>
              <Filter size={15} /> Aplicar
            </button>

            <button className="btn btn-secondary" onClick={resetDates}>
              <RotateCcw size={15} /> Mes actual
            </button>
          </div>
        </div>

        <div
          className="card finance-scope-card finance-summary-section"
          style={{ padding: 14, marginBottom: 14 }}
        >
          <div className="finance-scope-header">
            <div>
              <small>Vista de ventas</small>
              <strong>{selectedSalesScopeLabel}</strong>
              <p>{selectedSalesScopeDescription}</p>
            </div>

            <div className="finance-scope-tabs" role="tablist">
              {SALES_SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={salesScope === option.value ? "is-active" : ""}
                  onClick={() => setSalesScope(option.value)}
                >
                  <b>{option.label}</b>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          className="finance-mobile-tabs"
          role="tablist"
          aria-label="Secciones de finanzas"
        >
          <button
            type="button"
            className={mobileTab === "resumen" ? "is-active" : ""}
            onClick={() => setMobileTab("resumen")}
          >
            Resumen
          </button>

          <button
            type="button"
            className={mobileTab === "margenes" ? "is-active" : ""}
            onClick={() => setMobileTab("margenes")}
          >
            Márgenes
          </button>

          <button
            type="button"
            className={mobileTab === "movimientos" ? "is-active" : ""}
            onClick={() => setMobileTab("movimientos")}
          >
            Movimientos
          </button>
        </div>

        <div
          className="finance-stats-grid finance-summary-section"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <div className="stat-card">
            <div className="finance-stat-head">
              <div className="finance-stat-icon finance-stat-icon-green">
                <TrendingUp size={16} style={{ color: "var(--accent)" }} />
              </div>

              <span>Ingresos del rango</span>
            </div>

            <div className="stat-value finance-positive-value">{fmt(ingresos)}</div>
          </div>

          <div className="stat-card">
            <div className="finance-stat-head">
              <div className="finance-stat-icon finance-stat-icon-red">
                <TrendingDown size={16} style={{ color: "var(--danger)" }} />
              </div>

              <span>Egresos del rango</span>
            </div>

            <div className="stat-value finance-negative-value">{fmt(egresos)}</div>
          </div>

          <div className="stat-card">
            <div className="finance-stat-head">
              <div className="finance-stat-icon finance-stat-icon-blue">
                <Wallet size={16} style={{ color: "var(--accent2)" }} />
              </div>

              <span>Balance financiero</span>
            </div>

            <div
              className="stat-value"
              style={{ color: balance >= 0 ? "var(--accent)" : "var(--danger)" }}
            >
              {fmt(balance)}
            </div>
          </div>

          <div className="stat-card">
            <div className="finance-stat-head">
              <div
                className={
                  resultadoEstimado >= 0
                    ? "finance-stat-icon finance-stat-icon-green"
                    : "finance-stat-icon finance-stat-icon-red"
                }
              >
                <HandCoins
                  size={16}
                  style={{
                    color:
                      resultadoEstimado >= 0 ? "var(--accent)" : "var(--danger)",
                  }}
                />
              </div>

              <span>Resultado estimado</span>
            </div>

            <div
              className="stat-value"
              style={{
                color:
                  resultadoEstimado >= 0 ? "var(--accent)" : "var(--danger)",
              }}
            >
              {fmt(resultadoEstimado)}
            </div>
          </div>
        </div>

        <div
          className="finance-stats-grid finance-stats-grid-secondary finance-summary-section"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <div className="stat-card">
            <div className="finance-stat-head">
              <ReceiptText size={16} style={{ color: "var(--accent2)" }} />
              <span>Ventas {selectedSalesScopeLabel.toLowerCase()}</span>
            </div>

            <div className="stat-value finance-blue-value">{fmt(ventasFacturadas)}</div>

            <div className="finance-stat-subtitle">
              {selectedSalesStats.salesCount} ventas · {selectedSalesStats.itemsCount} ítems
            </div>
          </div>

          <div className="stat-card">
            <div className="finance-stat-head">
              <PackageCheck size={16} style={{ color: "var(--text2)" }} />
              <span>Costo vendido</span>
            </div>

            <div className="stat-value">{fmt(costoVendido)}</div>
            <div className="finance-stat-subtitle">Vista {selectedSalesScopeLabel}</div>
          </div>

          <div className="stat-card">
            <div className="finance-stat-head">
              <TrendingUp size={16} style={{ color: "var(--accent)" }} />
              <span>Utilidad bruta</span>
            </div>

            <div
              className="stat-value"
              style={{ color: utilidadBruta >= 0 ? "var(--accent)" : "var(--danger)" }}
            >
              {fmt(utilidadBruta)}
            </div>
            <div className="finance-stat-subtitle">Vista {selectedSalesScopeLabel}</div>
          </div>

          <div className="stat-card">
            <div className="finance-stat-head">
              <Percent size={16} style={{ color: "var(--accent)" }} />
              <span>Margen bruto</span>
            </div>

            <div
              className="stat-value"
              style={{ color: margenBruto >= 0 ? "var(--accent)" : "var(--danger)" }}
            >
              {pct(margenBruto)}
            </div>
            <div className="finance-stat-subtitle">Vista {selectedSalesScopeLabel}</div>
          </div>
        </div>

        <div className="card finance-margin-card" style={{ padding: 20, marginBottom: 20 }}>
          <div className="finance-card-header">
            <div>
              <div className="finance-title-row">
                <BadgeDollarSign size={17} style={{ color: "var(--accent)" }} />
                <h3>Margen sobre venta por producto</h3>
              </div>

              <p>
                Calculado como ganancia / precio de venta. En productos por KG usa los precios por KG.
              </p>
            </div>

            <div className="finance-badge-row">
              <span className="badge badge-green">
                Minorista prom. {pct(marginSummary.avgRetailMargin)}
              </span>
              <span className="badge badge-gray">
                Mayorista prom. {pct(marginSummary.avgWholesaleMargin)}
              </span>
              {marginSummary.productsWithoutCost > 0 && (
                <span className="badge badge-red">
                  {marginSummary.productsWithoutCost} sin costo
                </span>
              )}
            </div>
          </div>

          <div className="finance-margin-controls">
            <div className="finance-search-input">
              <Search size={16} />
              <input
                value={marginSearch}
                onChange={(e) => {
                  setMarginSearch(e.target.value);
                  setMarginPage(1);
                }}
                placeholder="Buscar producto, SKU o categoría..."
              />
            </div>

            <select
              value={marginSort}
              onChange={(e) => {
                setMarginSort(e.target.value as MarginSort);
                setMarginPage(1);
              }}
            >
              <option value="retailMargin">Ordenar por margen venta minorista</option>
              <option value="wholesaleMargin">Ordenar por margen venta mayorista</option>
              <option value="retailProfit">Ordenar por ganancia minorista</option>
              <option value="wholesaleProfit">Ordenar por ganancia mayorista</option>
              <option value="cost">Ordenar por costo</option>
              <option value="name">Ordenar por nombre</option>
            </select>
          </div>

          <div className="table-wrap finance-desktop-table finance-margin-table-wrap">
            <table className="finance-margin-table">
              <colgroup>
                <col style={{ width: "24%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "11%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Costo</th>
                  <th>Minorista</th>
                  <th>Ganancia min.</th>
                  <th>Margen venta min.</th>
                  <th>Mayorista</th>
                  <th>Ganancia may.</th>
                  <th>Margen venta may.</th>
                </tr>
              </thead>

              <tbody>
                {filteredMarginRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{row.name}</div>
                      <div className="finance-badge-row compact">
                        <span className="badge badge-gray">
                          {row.saleUnit === "KG" ? "Por KG" : "Unidad"}
                        </span>
                        {row.sku && <span className="badge badge-gray">SKU {row.sku}</span>}
                        <span className="badge badge-gray">{row.category}</span>
                      </div>
                    </td>

                    <td style={{ fontFamily: "var(--mono)", fontWeight: 800 }}>
                      {row.cost > 0 ? (
                        fmt(row.cost)
                      ) : (
                        <span style={{ color: "var(--danger)" }}>Sin costo</span>
                      )}
                    </td>
                    <td style={{ fontFamily: "var(--mono)" }}>{fmt(row.retailPrice)}</td>
                    <td
                      style={{
                        fontFamily: "var(--mono)",
                        fontWeight: 800,
                        color: getProfitColor(row.retailProfit),
                      }}
                    >
                      {fmtOptional(row.retailProfit)}
                    </td>
                    <td>
                      <span className={`badge ${getMarginBadgeClass(row.retailMargin)}`}>
                        {pct(row.retailMargin)}
                      </span>
                    </td>
                    <td style={{ fontFamily: "var(--mono)" }}>{fmt(row.wholesalePrice)}</td>
                    <td
                      style={{
                        fontFamily: "var(--mono)",
                        fontWeight: 800,
                        color: getProfitColor(row.wholesaleProfit),
                      }}
                    >
                      {fmtOptional(row.wholesaleProfit)}
                    </td>
                    <td>
                      <span className={`badge ${getMarginBadgeClass(row.wholesaleMargin)}`}>
                        {pct(row.wholesaleMargin)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!filteredMarginRows.length && (
              <div className="empty-state">
                <ArrowUpDown size={36} />
                <p>No hay productos para mostrar</p>
              </div>
            )}
          </div>

          <div className="finance-mobile-list">
            {paginatedMarginRows.map((row) => (
              <article key={row.id} className="finance-mobile-item finance-margin-mobile-item">
                <div className="finance-mobile-head">
                  <div>
                    <h4>{row.name}</h4>
                    <div className="finance-mobile-badges">
                      <span className="badge badge-gray">
                        {row.saleUnit === "KG" ? "Por KG" : "Unidad"}
                      </span>
                      {row.sku && <span className="badge badge-gray">SKU {row.sku}</span>}
                      <span className="badge badge-gray">{row.category}</span>
                    </div>
                  </div>
                </div>

                <div className="finance-mobile-data">
                  <div>
                    <small>Costo</small>
                    <strong>{row.cost > 0 ? fmt(row.cost) : "Sin costo"}</strong>
                  </div>
                  <div>
                    <small>Minorista</small>
                    <strong>{fmt(row.retailPrice)}</strong>
                  </div>
                  <div>
                    <small>Gana minorista</small>
                    <strong style={{ color: getProfitColor(row.retailProfit) }}>
                      {fmtOptional(row.retailProfit)}
                    </strong>
                  </div>
                  <div>
                    <small>Margen venta minorista</small>
                    <span className={`badge ${getMarginBadgeClass(row.retailMargin)}`}>
                      {pct(row.retailMargin)}
                    </span>
                  </div>
                  <div>
                    <small>Mayorista</small>
                    <strong>{fmt(row.wholesalePrice)}</strong>
                  </div>
                  <div>
                    <small>Gana mayorista</small>
                    <strong style={{ color: getProfitColor(row.wholesaleProfit) }}>
                      {fmtOptional(row.wholesaleProfit)}
                    </strong>
                  </div>
                  <div>
                    <small>Margen venta mayorista</small>
                    <span className={`badge ${getMarginBadgeClass(row.wholesaleMargin)}`}>
                      {pct(row.wholesaleMargin)}
                    </span>
                  </div>
                </div>
              </article>
            ))}

            {!filteredMarginRows.length && (
              <div className="empty-state">
                <ArrowUpDown size={36} />
                <p>No hay productos para mostrar</p>
              </div>
            )}
          </div>

          {!loading && filteredMarginRows.length > MOBILE_MARGIN_PAGE_SIZE && (
            <div className="finance-pagination finance-margin-pagination">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setMarginPage((page) => Math.max(1, page - 1))}
                disabled={currentMarginPage <= 1}
              >
                Anterior
              </button>

              <span>
                Página {currentMarginPage} de {totalMarginPages} · {filteredMarginRows.length} productos
              </span>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setMarginPage((page) => Math.min(totalMarginPages, page + 1))}
                disabled={currentMarginPage >= totalMarginPages}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>

        <div
          className="finance-mini-stats-grid finance-summary-section"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <div className="stat-card">
            <div className="finance-stat-head">
              <CalendarDays size={16} style={{ color: "var(--accent)" }} />
              <span>Semana de la fecha hasta</span>
            </div>
            <div className="stat-value finance-positive-value">{fmt(stats.week)}</div>
          </div>

          <div className="stat-card">
            <div className="finance-stat-head">
              <CalendarDays size={16} style={{ color: "var(--accent)" }} />
              <span>Mes de la fecha hasta</span>
            </div>
            <div className="stat-value finance-positive-value">{fmt(stats.month)}</div>
          </div>

          <div className="stat-card">
            <div className="finance-stat-head">
              <CalendarDays size={16} style={{ color: "var(--accent)" }} />
              <span>Año de la fecha hasta</span>
            </div>
            <div className="stat-value finance-positive-value">{fmt(stats.year)}</div>
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="card finance-chart-card finance-summary-section" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
              Flujo de caja y utilidad del rango · {selectedSalesScopeLabel}
            </div>

            <div className="finance-chart-wrap">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ left: -20 }}>
                  <XAxis
                    dataKey="date"
                    tick={{
                      fill: "var(--text3)",
                      fontSize: 11,
                      fontFamily: "var(--mono)",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    tick={{
                      fill: "var(--text3)",
                      fontSize: 10,
                      fontFamily: "var(--mono)",
                    }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`}
                  />

                  <Tooltip
                    contentStyle={{
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontFamily: "var(--mono)",
                      fontSize: 12,
                    }}
                    formatter={(v: unknown) => fmt(Number(v))}
                  />

                  <Bar dataKey="ingresos" fill="var(--accent)" radius={[3, 3, 0, 0]} opacity={0.85} name="Ingresos" />
                  <Bar dataKey="egresos" fill="var(--danger)" radius={[3, 3, 0, 0]} opacity={0.7} name="Egresos" />
                  <Bar dataKey="utilidad" fill="var(--accent2)" radius={[3, 3, 0, 0]} opacity={0.75} name="Utilidad" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {categoryStats.length > 0 && (
          <div className="card finance-category-card finance-summary-section" style={{ padding: 20, marginBottom: 20 }}>
            <div className="finance-title-row" style={{ marginBottom: 16 }}>
              <Tags size={16} style={{ color: "var(--accent2)" }} />
              <h3>Ingresos por categoría del rango</h3>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {categoryStats.map((item: AnyObj, index: number) => {
                const category = item.category ?? item.name ?? item.label ?? "Sin categoría";
                const total =
                  item.total ??
                  item.amount ??
                  item.income ??
                  item.totalIncome ??
                  item._sum?.amount ??
                  0;

                return (
                  <div key={`${category}-${index}`} className="finance-category-row">
                    <span>{categoryLabel(category)}</span>
                    <span>{fmt(Number(total || 0))}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="finance-products-grid finance-summary-section">
          <div className="card finance-product-card" style={{ padding: 20 }}>
            <div className="finance-title-row" style={{ marginBottom: 16 }}>
              <Trophy size={16} style={{ color: "var(--accent)" }} />
              <h3>Productos más vendidos · {selectedSalesScopeLabel}</h3>
            </div>

            {topProducts.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {topProducts.slice(0, 5).map((p: AnyObj, index: number) => (
                  <div key={p.id ?? `${getProductName(p)}-${index}`} className="finance-product-row">
                    <span>
                      {index + 1}. {getProductName(p)}
                    </span>
                    <span>{getProductQty(p)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--text2)", fontSize: 13, margin: 0 }}>
                Sin datos todavía
              </p>
            )}
          </div>

          <div className="card finance-product-card" style={{ padding: 20 }}>
            <div className="finance-title-row" style={{ marginBottom: 16 }}>
              <AlertTriangle size={16} style={{ color: "var(--danger)" }} />
              <h3>Productos con menor venta · {selectedSalesScopeLabel}</h3>
            </div>

            {filteredWorstProducts.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {filteredWorstProducts.slice(0, 5).map((p: AnyObj, index: number) => (
                  <div key={p.id ?? `${getProductName(p)}-${index}`} className="finance-product-row is-danger">
                    <span>
                      {index + 1}. {getProductName(p)}
                    </span>
                    <span>{getProductQty(p)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--text2)", fontSize: 13, margin: 0 }}>
                Sin datos todavía
              </p>
            )}
          </div>
        </div>

        <div className="finance-movements-split-grid">
          <div className="card finance-movements-card finance-income-movements-card">
            <div className="finance-movements-title">
              <div>
                <h3>Últimos ingresos</h3>
                <p>Movimientos de dinero que entró al negocio.</p>
              </div>

              <span className="badge badge-green">
                {recentIncomeEntries.length} ingresos
              </span>
            </div>

            <div className="table-wrap finance-desktop-table">
              {loading ? (
                <div style={{ padding: 20 }}>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />
                  ))}
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Descripción</th>
                      <th>Categoría</th>
                      <th>Importe</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedIncomeEntries.map((e) => (
                      <tr
                        key={e.id}
                        className="finance-movement-row"
                        role="button"
                        tabIndex={0}
                        title="Ver detalle del ingreso"
                        onClick={() => setSelectedMovement(e)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedMovement(e);
                          }
                        }}
                      >
                        <td className="finance-date-cell">{formatDateOnly(e.date)}</td>
                        <td className="finance-desc-cell">
                          {getCleanMovementDescription(e as AnyObj) || "—"}
                        </td>
                        <td>
                          <span className="badge badge-gray">{categoryLabel(e.category)}</span>
                        </td>
                        <td className="finance-money-cell finance-positive">+{fmt(Number(e.amount || 0))}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm finance-detail-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedMovement(e);
                            }}
                          >
                            <Eye size={13} /> Ver detalle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {!loading && !recentIncomeEntries.length && (
                <div className="empty-state">
                  <TrendingUp size={36} />
                  <p>Sin ingresos en el rango seleccionado</p>
                </div>
              )}
            </div>

            <div className="finance-mobile-list finance-movements-mobile">
              {loading ? (
                <div style={{ padding: 14 }}>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: 88, marginBottom: 10, borderRadius: 16 }} />
                  ))}
                </div>
              ) : (
                paginatedIncomeEntries.map((e) => (
                  <article
                    key={e.id}
                    className="finance-mobile-item finance-movement-row"
                    role="button"
                    tabIndex={0}
                    title="Ver detalle del ingreso"
                    onClick={() => setSelectedMovement(e)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedMovement(e);
                      }
                    }}
                  >
                    <div className="finance-mobile-head">
                      <div>
                        <div className="finance-mobile-badges">
                          <span className="badge badge-green">↑ INGRESO</span>
                          <span className="badge badge-gray">{categoryLabel(e.category)}</span>
                        </div>

                        <h4>{getCleanMovementDescription(e as AnyObj) || "—"}</h4>
                        <p>{formatDateOnly(e.date)}</p>
                      </div>

                      <strong className="finance-positive">+{fmt(Number(e.amount || 0))}</strong>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm finance-mobile-detail-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedMovement(e);
                      }}
                    >
                      <Eye size={13} /> Ver detalle
                    </button>
                  </article>
                ))
              )}

              {!loading && !recentIncomeEntries.length && (
                <div className="empty-state">
                  <TrendingUp size={36} />
                  <p>Sin ingresos en el rango seleccionado</p>
                </div>
              )}
            </div>

            {!loading && recentIncomeEntries.length > MOVEMENTS_PAGE_SIZE && (
              <div className="finance-pagination">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIncomeMovementsPage((page) => Math.max(1, page - 1))}
                  disabled={currentIncomeMovementPage <= 1}
                >
                  Anterior
                </button>

                <span>
                  Página {currentIncomeMovementPage} de {totalIncomeMovementPages}
                </span>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    setIncomeMovementsPage((page) =>
                      Math.min(totalIncomeMovementPages, page + 1),
                    )
                  }
                  disabled={currentIncomeMovementPage >= totalIncomeMovementPages}
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>

          <div className="card finance-movements-card finance-expense-movements-card">
            <div className="finance-movements-title">
              <div>
                <h3>Últimos egresos</h3>
                <p>Movimientos de dinero que salió del negocio.</p>
              </div>

              <span className="badge badge-red">
                {recentExpenseEntries.length} egresos
              </span>
            </div>

            <div className="table-wrap finance-desktop-table">
              {loading ? (
                <div style={{ padding: 20 }}>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />
                  ))}
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Descripción</th>
                      <th>Categoría</th>
                      <th>Importe</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedExpenseEntries.map((e) => (
                      <tr
                        key={e.id}
                        className="finance-movement-row"
                        role="button"
                        tabIndex={0}
                        title="Ver detalle del egreso"
                        onClick={() => setSelectedMovement(e)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedMovement(e);
                          }
                        }}
                      >
                        <td className="finance-date-cell">{formatDateOnly(e.date)}</td>
                        <td className="finance-desc-cell">
                          {getCleanMovementDescription(e as AnyObj) || "—"}
                        </td>
                        <td>
                          <span className="badge badge-gray">{categoryLabel(e.category)}</span>
                        </td>
                        <td className="finance-money-cell finance-negative">-{fmt(Number(e.amount || 0))}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm finance-detail-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedMovement(e);
                            }}
                          >
                            <Eye size={13} /> Ver detalle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {!loading && !recentExpenseEntries.length && (
                <div className="empty-state">
                  <TrendingDown size={36} />
                  <p>Sin egresos en el rango seleccionado</p>
                </div>
              )}
            </div>

            <div className="finance-mobile-list finance-movements-mobile">
              {loading ? (
                <div style={{ padding: 14 }}>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: 88, marginBottom: 10, borderRadius: 16 }} />
                  ))}
                </div>
              ) : (
                paginatedExpenseEntries.map((e) => (
                  <article
                    key={e.id}
                    className="finance-mobile-item finance-movement-row"
                    role="button"
                    tabIndex={0}
                    title="Ver detalle del egreso"
                    onClick={() => setSelectedMovement(e)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedMovement(e);
                      }
                    }}
                  >
                    <div className="finance-mobile-head">
                      <div>
                        <div className="finance-mobile-badges">
                          <span className="badge badge-red">↓ EGRESO</span>
                          <span className="badge badge-gray">{categoryLabel(e.category)}</span>
                        </div>

                        <h4>{getCleanMovementDescription(e as AnyObj) || "—"}</h4>
                        <p>{formatDateOnly(e.date)}</p>
                      </div>

                      <strong className="finance-negative">-{fmt(Number(e.amount || 0))}</strong>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm finance-mobile-detail-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedMovement(e);
                      }}
                    >
                      <Eye size={13} /> Ver detalle
                    </button>
                  </article>
                ))
              )}

              {!loading && !recentExpenseEntries.length && (
                <div className="empty-state">
                  <TrendingDown size={36} />
                  <p>Sin egresos en el rango seleccionado</p>
                </div>
              )}
            </div>

            {!loading && recentExpenseEntries.length > MOVEMENTS_PAGE_SIZE && (
              <div className="finance-pagination">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setExpenseMovementsPage((page) => Math.max(1, page - 1))}
                  disabled={currentExpenseMovementPage <= 1}
                >
                  Anterior
                </button>

                <span>
                  Página {currentExpenseMovementPage} de {totalExpenseMovementPages}
                </span>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    setExpenseMovementsPage((page) =>
                      Math.min(totalExpenseMovementPages, page + 1),
                    )
                  }
                  disabled={currentExpenseMovementPage >= totalExpenseMovementPages}
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {modal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={(e) => e.target === e.currentTarget && setModal(false)}
          >
            <div className="modal finance-modal">
              <div className="modal-header">
                <span style={{ fontWeight: 800 }}>Nueva entrada financiera</span>

                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setModal(false)}
                  style={{ padding: 6 }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body">
                <div className="form-row finance-form-row">
                  <div className="form-group">
                    <label className="form-label">Tipo *</label>

                    <select
                      value={form.type}
                      onChange={(e) => field("type", e.target.value as FinanceForm["type"])}
                    >
                      <option value="INGRESO">Ingreso</option>
                      <option value="EGRESO">Egreso</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Fecha *</label>

                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => field("date", e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Importe *</label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => field("amount", e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Descripción *</label>

                  <input
                    value={form.description}
                    onChange={(e) => field("description", e.target.value)}
                    placeholder="Ej: Alquiler mayo, sueldo empleado, pago proveedor..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Categoría *</label>

                  <select
                    value={form.category}
                    onChange={(e) => field("category", e.target.value)}
                  >
                    {FINANCE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer finance-modal-footer">
                <button className="btn btn-secondary" onClick={() => setModal(false)}>
                  Cancelar
                </button>

                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving || !form.amount || !form.description || !form.category}
                >
                  {saving ? <span className="spinner" /> : "Guardar"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {selectedMovement &&
        selectedMovementData &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={(e) => e.target === e.currentTarget && setSelectedMovement(null)}
          >
            <div className="modal finance-modal finance-detail-modal">
              <div className="modal-header">
                <span style={{ fontWeight: 800 }}>Detalle del movimiento</span>

                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedMovement(null)}
                  style={{ padding: 6 }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body">
                <div className="movement-detail-hero">
                  <div className="movement-detail-icon">
                    <Eye size={20} />
                  </div>

                  <div>
                    <span
                      className={`badge ${
                        selectedMovement.type === "INGRESO" ? "badge-green" : "badge-red"
                      }`}
                    >
                      {selectedMovement.type === "INGRESO" ? "↑" : "↓"} {selectedMovement.type}
                    </span>

                    <h3>
                      {getCleanMovementDescription(selectedMovementData) ||
                        "Movimiento sin descripción"}
                    </h3>

                    <strong
                      className={
                        selectedMovement.type === "INGRESO"
                          ? "finance-positive"
                          : "finance-negative"
                      }
                    >
                      {selectedMovement.type === "INGRESO" ? "+" : "-"}
                      {fmt(Number(selectedMovement.amount || 0))}
                    </strong>
                  </div>
                </div>

                <div className="movement-sale-card">
                  <div className="movement-sale-card-head">
                    <div>
                      <small>
                        {selectedMovementLink?.type === "purchase"
                          ? "Compra vinculada"
                          : "Venta vinculada"}
                      </small>
                      <strong>
                        {selectedMovementLinkedDetail?.id
                          ? `${
                              selectedMovementLink?.type === "purchase" ? "Compra" : "Venta"
                            } #${String(selectedMovementLinkedDetail.id).slice(0, 8)}`
                          : `Sin ${
                              selectedMovementLink?.type === "purchase" ? "compra" : "venta"
                            } vinculada`}
                      </strong>
                    </div>

                    {selectedMovementLinkedDetail?.status && (
                      <span className="badge badge-gray">
                        {selectedMovementLinkedDetail.status}
                      </span>
                    )}
                  </div>

                  <div className="movement-sale-grid">
                    <div>
                      <small>Total</small>
                      <strong>
                        {getLinkedMovementTotal(
                          selectedMovementLinkedDetail,
                          selectedMovementData,
                        ) !== null
                          ? fmt(
                              Number(
                                getLinkedMovementTotal(
                                  selectedMovementLinkedDetail,
                                  selectedMovementData,
                                ) || 0,
                              ),
                            )
                          : "—"}
                      </strong>
                    </div>

                    <div>
                      <small>
                        {selectedMovementLink?.type === "purchase" ? "Proveedor" : "Cliente"}
                      </small>
                      <strong>
                        {selectedMovementLink?.type === "purchase"
                          ? getPurchaseSupplierName(selectedMovementPurchase)
                          : getSaleClientName(selectedMovementSale)}
                      </strong>
                    </div>

                    <div>
                      <small>Método de pago</small>
                      <strong>{getLinkedPaymentLabel(selectedMovementLinkedDetail)}</strong>
                    </div>

                    <div>
                      <small>
                        {selectedMovementLink?.type === "purchase"
                          ? "Fecha de compra"
                          : "Fecha de venta"}
                      </small>
                      <strong>
                        {formatDateTime(
                          selectedMovementLink?.type === "purchase"
                            ? selectedMovementLinkedDetail?.date ??
                                selectedMovementLinkedDetail?.createdAt
                            : selectedMovementLinkedDetail?.createdAt ??
                                selectedMovementLinkedDetail?.date,
                        )}
                      </strong>
                    </div>

                    <div>
                      <small>ID vinculado</small>
                      <strong>{selectedMovementLinkedDetail?.id || "—"}</strong>
                    </div>
                  </div>
                </div>

                {selectedMovementLink && (
                  <div className="movement-products-card">
                    <div className="movement-products-head">
                      <div>
                        <small>Detalle de productos</small>
                        <strong>
                          {selectedMovementLink.type === "purchase"
                            ? "Productos comprados"
                            : "Productos vendidos"}
                        </strong>
                      </div>

                      <span className="badge badge-gray">
                        {selectedLinkedItems.length} item
                        {selectedLinkedItems.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {selectedLinkedItems.length ? (
                      <div className="movement-products-table-wrap">
                        <table className="movement-products-table">
                          <thead>
                            <tr>
                              <th>Producto</th>
                              <th>Cant.</th>
                              <th>
                                {selectedMovementLink.type === "purchase"
                                  ? "Costo unit."
                                  : "Precio unit."}
                              </th>
                              <th>Subtotal</th>
                            </tr>
                          </thead>

                          <tbody>
                            {selectedLinkedItems.map((item: AnyObj, index) => (
                              <tr key={item.id ?? `${getLinkedItemName(item)}-${index}`}>
                                <td>
                                  <b>{getLinkedItemName(item)}</b>
                                  {getLinkedItemSku(item) && (
                                    <small>SKU {getLinkedItemSku(item)}</small>
                                  )}
                                </td>
                                <td>{getLinkedItemQuantityLabel(item)}</td>
                                <td>{fmt(getLinkedItemUnitPrice(item))}</td>
                                <td>{fmt(getLinkedItemSubtotal(item))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="movement-products-empty">
                        {selectedMovementLinkedDetail?.id
                          ? "No encontré productos cargados en este detalle."
                          : "Cargando detalle vinculado..."}
                      </div>
                    )}
                  </div>
                )}

                <div className="movement-detail-grid">
                  <div>
                    <small>Fecha del movimiento</small>
                    <strong>{formatDateOnly(selectedMovement.date)}</strong>
                  </div>

                  <div>
                    <small>Categoría</small>
                    <strong>{categoryLabel(selectedMovement.category)}</strong>
                  </div>

                  <div>
                    <small>Tipo</small>
                    <strong>{selectedMovement.type}</strong>
                  </div>

                  <div>
                    <small>Importe</small>
                    <strong>{fmt(Number(selectedMovement.amount || 0))}</strong>
                  </div>

                  <div className="movement-detail-full">
                    <small>Descripción</small>
                    <strong>{getCleanMovementDescription(selectedMovementData) || "—"}</strong>
                  </div>

                  <div>
                    <small>ID interno</small>
                    <strong>{selectedMovement.id || "—"}</strong>
                  </div>

                  <div>
                    <small>Creado</small>
                    <strong>{formatDateTime(selectedMovementData.createdAt)}</strong>
                  </div>

                  <div>
                    <small>Actualizado</small>
                    <strong>{formatDateTime(selectedMovementData.updatedAt)}</strong>
                  </div>
                </div>
              </div>

              <div className="modal-footer finance-modal-footer">
                <button className="btn btn-secondary" onClick={() => setSelectedMovement(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <style jsx>{`
        .finance-page {
          --finance-radius-xl: 22px;
          --finance-radius-lg: 18px;
          --finance-radius-md: 14px;
          --finance-gap: clamp(10px, 1.1vw, 16px);
          position: relative;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-x: clip;
          box-sizing: border-box;
          margin: 0;
          padding-bottom: 18px;
          container-type: inline-size;
          container-name: finance;
        }

        .finance-page *,
        .finance-page *::before,
        .finance-page *::after {
          box-sizing: border-box;
        }

        .finance-page :global(.card),
        .finance-page :global(.stat-card),
        .finance-page :global(.table-wrap) {
          width: 100%;
          max-width: 100%;
          min-width: 0;
        }

        .finance-page :global(input),
        .finance-page :global(select),
        .finance-page :global(button) {
          max-width: 100%;
        }

        .finance-filter-card,
        .finance-scope-card,
        .finance-margin-card,
        .finance-chart-card,
        .finance-category-card,
        .finance-product-card,
        .finance-movements-card,
        .finance-page :global(.stat-card) {
          border-radius: var(--finance-radius-lg);
          border: 1px solid var(--border);
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
        }

        .finance-filter-card {
          background: color-mix(in srgb, var(--surface) 95%, var(--accent2));
        }

        .finance-filter-grid {
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr)) !important;
          justify-content: stretch;
        }

        .finance-filter-grid .form-group {
          min-width: 0;
        }

        .finance-filter-grid button {
          min-height: 42px;
          width: 100%;
          white-space: nowrap;
          justify-content: center;
        }

        .finance-scope-card {
          border: 1px solid color-mix(in srgb, var(--accent2) 24%, var(--border));
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--accent2) 9%, var(--surface)),
            var(--surface)
          );
        }

        .finance-scope-header {
          display: grid;
          grid-template-columns: minmax(min(100%, 230px), 0.7fr) minmax(0, 1.8fr);
          gap: var(--finance-gap);
          align-items: center;
        }

        .finance-scope-header small {
          display: block;
          color: var(--text3);
          font-size: 10px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 5px;
        }

        .finance-scope-header strong {
          display: block;
          color: var(--text);
          font-size: 20px;
          font-weight: 950;
          line-height: 1.15;
        }

        .finance-scope-header p {
          margin: 5px 0 0;
          color: var(--text2);
          font-size: 12px;
          line-height: 1.3;
        }

        .finance-scope-tabs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
          gap: 10px;
          align-items: stretch;
        }

        .finance-scope-tabs button {
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--surface2);
          color: var(--text2);
          min-height: 62px;
          padding: 10px 12px;
          display: grid;
          gap: 4px;
          text-align: left;
          cursor: pointer;
          transition:
            border-color 0.16s ease,
            background 0.16s ease,
            transform 0.16s ease,
            box-shadow 0.16s ease;
        }

        .finance-scope-tabs button:hover {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--accent2) 55%, var(--border));
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }

        .finance-scope-tabs button.is-active {
          border-color: var(--accent2);
          background: color-mix(in srgb, var(--accent2) 14%, var(--surface));
          color: var(--accent2);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent2) 15%, transparent);
        }

        .finance-scope-tabs b {
          font-size: 13px;
          font-weight: 950;
          line-height: 1.1;
        }

        .finance-scope-tabs span {
          color: var(--text3);
          font-size: 10.5px;
          font-weight: 850;
          line-height: 1.2;
        }

        .finance-stats-grid,
        .finance-stats-grid-secondary {
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)) !important;
          gap: var(--finance-gap) !important;
        }

        .finance-mini-stats-grid {
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)) !important;
          gap: var(--finance-gap) !important;
        }

        .finance-page :global(.stat-card) {
          padding: clamp(12px, 1.15vw, 16px) !important;
          min-height: 112px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: var(--surface);
        }

        .finance-stat-head {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 12px;
          min-width: 0;
        }

        .finance-stat-head span {
          font-size: 12px;
          color: var(--text2);
          font-weight: 750;
          line-height: 1.25;
          min-width: 0;
        }

        .finance-stat-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }

        .finance-stat-icon-green {
          background: rgba(15, 159, 92, 0.1);
        }

        .finance-stat-icon-red {
          background: rgba(239, 68, 68, 0.1);
        }

        .finance-stat-icon-blue {
          background: rgba(79, 142, 255, 0.1);
        }

        .finance-page :global(.stat-value) {
          font-size: clamp(18px, 1.4vw, 24px) !important;
          line-height: 1.05;
          font-weight: 950;
          overflow-wrap: anywhere;
        }

        .finance-positive-value,
        .finance-positive {
          color: var(--accent) !important;
        }

        .finance-negative-value,
        .finance-negative {
          color: var(--danger) !important;
        }

        .finance-blue-value {
          color: var(--accent2) !important;
        }

        .finance-stat-subtitle {
          margin-top: 7px;
          color: var(--text3);
          font-size: 11px;
          font-weight: 850;
          line-height: 1.25;
        }

        .finance-card-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(220px, auto);
          gap: var(--finance-gap);
          align-items: start;
          margin-bottom: 16px;
        }

        .finance-card-header h3,
        .finance-title-row h3 {
          margin: 0;
          font-size: 16px;
          line-height: 1.2;
          font-weight: 950;
          color: var(--text);
        }

        .finance-card-header p {
          margin: 6px 0 0;
          color: var(--text2);
          font-size: 13px;
          line-height: 1.4;
        }

        .finance-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .finance-title-row svg {
          flex: 0 0 auto;
        }

        .finance-badge-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .finance-badge-row.compact {
          gap: 6px;
          margin-top: 6px;
          justify-content: flex-start;
        }

        .finance-margin-card,
        .finance-chart-card,
        .finance-category-card,
        .finance-product-card {
          background: var(--surface);
        }

        .finance-margin-controls {
          display: grid;
          grid-template-columns: minmax(min(100%, 260px), 1fr) minmax(min(100%, 220px), 300px);
          gap: 12px;
          margin-bottom: 14px;
          align-items: center;
        }

        .finance-search-input {
          position: relative;
          min-width: 0;
        }

        .finance-search-input svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text3);
          pointer-events: none;
        }

        .finance-search-input input {
          padding-left: 38px;
          width: 100%;
        }

        .finance-desktop-table {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          border-radius: 16px;
        }

        .finance-desktop-table table {
          width: 100%;
          min-width: 760px;
          table-layout: fixed;
        }

        .finance-desktop-table th,
        .finance-desktop-table td {
          min-width: 0;
          overflow-wrap: anywhere;
          word-break: normal;
          vertical-align: top;
        }

        .finance-margin-table-wrap {
          border: 1px solid var(--border);
          background: var(--surface2);
        }

        .finance-margin-table-wrap table {
          min-width: 1120px;
          table-layout: fixed;
        }

        .finance-margin-table th,
        .finance-margin-table td {
          padding-left: 10px;
          padding-right: 10px;
        }

        .finance-margin-table th {
          font-size: 10px;
          letter-spacing: 0.045em;
          line-height: 1.15;
          vertical-align: bottom;
          white-space: normal;
        }

        .finance-margin-table td {
          font-size: 14px;
          vertical-align: top;
        }

        .finance-margin-table td:not(:first-child) {
          font-size: 13px;
          font-family: var(--mono);
        }

        .finance-margin-table .badge {
          white-space: nowrap;
        }

        .finance-mobile-list {
          display: none;
        }

        .finance-mobile-tabs {
          display: none;
        }

        .finance-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px 16px;
          border-top: 1px solid var(--border);
          background: var(--surface);
        }

        .finance-pagination span {
          color: var(--text2);
          font-size: 12px;
          font-family: var(--mono);
          text-align: center;
        }

        .finance-chart-wrap {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          height: 260px;
          overflow: hidden;
        }

        .finance-category-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--surface2);
        }

        .finance-category-row span:first-child {
          font-size: 13px;
          font-weight: 800;
          min-width: 0;
        }

        .finance-category-row span:last-child {
          font-family: var(--mono);
          font-weight: 900;
          flex: 0 0 auto;
        }

        .finance-products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
          gap: var(--finance-gap);
          margin-bottom: 20px;
        }

        .finance-product-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px dashed color-mix(in srgb, var(--border) 70%, transparent);
          font-size: 13px;
        }

        .finance-product-row:last-child {
          border-bottom: 0;
        }

        .finance-product-row span:first-child {
          font-weight: 800;
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .finance-product-row span:last-child {
          font-family: var(--mono);
          color: var(--accent);
          font-weight: 900;
          flex: 0 0 auto;
        }

        .finance-product-row.is-danger span:last-child {
          color: var(--danger);
        }

        .finance-movements-split-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 560px), 1fr));
          gap: var(--finance-gap);
          margin-bottom: 20px;
        }

        .finance-movements-card {
          background: var(--surface);
        }

        .finance-income-movements-card {
          border-top: 3px solid var(--accent);
        }

        .finance-expense-movements-card {
          border-top: 3px solid var(--danger);
        }

        .finance-movements-title {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 16px 12px;
        }

        .finance-movements-title h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 950;
        }

        .finance-movements-title p {
          margin: 4px 0 0;
          color: var(--text2);
          font-size: 13px;
        }

        .finance-movements-card .finance-desktop-table table {
          min-width: 720px;
        }

        .finance-movement-row {
          cursor: pointer;
          transition:
            background 0.15s ease,
            transform 0.15s ease,
            box-shadow 0.15s ease;
        }

        .finance-movement-row:hover {
          background: color-mix(in srgb, var(--accent2) 8%, transparent);
        }

        .finance-movement-row:focus-visible {
          outline: 2px solid var(--accent2);
          outline-offset: -2px;
        }

        .finance-date-cell {
          font-size: 12px;
          color: var(--text2);
          font-family: var(--mono);
        }

        .finance-desc-cell {
          font-size: 13px;
          font-weight: 700;
        }

        .finance-money-cell {
          font-family: var(--mono);
          font-weight: 900;
          white-space: nowrap;
        }

        .finance-detail-button,
        .finance-mobile-detail-button {
          gap: 6px;
          white-space: nowrap;
          justify-content: center;
        }

        .finance-mobile-detail-button {
          width: 100%;
          margin-top: 10px;
        }

        .movement-detail-hero {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--surface2);
          margin-bottom: 14px;
        }

        .movement-detail-icon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: color-mix(in srgb, var(--accent2) 14%, var(--surface));
          color: var(--accent2);
          flex-shrink: 0;
        }

        .movement-detail-hero h3 {
          margin: 8px 0 6px;
          font-size: 17px;
          font-weight: 900;
          line-height: 1.25;
          color: var(--text);
        }

        .movement-detail-hero strong {
          font-family: var(--mono);
          font-size: 20px;
          font-weight: 900;
        }

        .movement-sale-card,
        .movement-products-card {
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--surface2);
          margin-bottom: 14px;
        }

        .movement-sale-card {
          background: color-mix(in srgb, var(--accent2) 7%, var(--surface2));
        }

        .movement-sale-card-head,
        .movement-products-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 12px;
        }

        .movement-sale-card-head div,
        .movement-products-head div {
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        .movement-sale-card small,
        .movement-sale-grid small,
        .movement-products-head small,
        .movement-detail-grid small {
          color: var(--text3);
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .movement-sale-card strong,
        .movement-sale-grid strong,
        .movement-detail-grid strong {
          color: var(--text);
          font-size: 13px;
          font-weight: 850;
          overflow-wrap: anywhere;
        }

        .movement-sale-card-head strong,
        .movement-products-head strong {
          font-size: 16px;
          font-weight: 950;
        }

        .movement-sale-grid,
        .movement-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .movement-sale-grid > div,
        .movement-detail-grid > div {
          display: grid;
          gap: 5px;
          min-width: 0;
          padding: 10px;
          border-radius: 12px;
          background: var(--surface);
          border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
        }

        .movement-detail-grid > div {
          padding: 12px;
          border-radius: 14px;
          background: var(--surface2);
        }

        .movement-detail-full {
          grid-column: 1 / -1;
        }

        .movement-products-table-wrap {
          width: 100%;
          overflow-x: auto;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--surface);
        }

        .movement-products-table {
          width: 100%;
          min-width: 560px;
          border-collapse: collapse;
        }

        .movement-products-table th,
        .movement-products-table td {
          padding: 10px;
          border-bottom: 1px solid var(--border);
          text-align: left;
          font-size: 12px;
        }

        .movement-products-table th {
          color: var(--text3);
          font-size: 10px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .movement-products-table td:not(:first-child) {
          font-family: var(--mono);
          font-weight: 800;
          white-space: nowrap;
        }

        .movement-products-table td:first-child {
          display: grid;
          gap: 3px;
          min-width: 220px;
        }

        .movement-products-table td:first-child b {
          color: var(--text);
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .movement-products-table td:first-child small {
          color: var(--text3);
          font-size: 10px;
          font-weight: 800;
        }

        .movement-products-table tr:last-child td {
          border-bottom: 0;
        }

        .movement-products-empty {
          border: 1px dashed var(--border);
          border-radius: 14px;
          padding: 14px;
          color: var(--text3);
          text-align: center;
          font-size: 12px;
          background: var(--surface);
        }


        @container finance (max-width: 1240px) {
          .finance-movements-split-grid {
            grid-template-columns: 1fr;
          }

          .finance-movements-card .finance-desktop-table table {
            min-width: 680px;
          }
        }

        @container finance (max-width: 1060px) {
          .finance-scope-header,
          .finance-card-header {
            grid-template-columns: 1fr;
          }

          .finance-badge-row {
            justify-content: flex-start;
          }

          .finance-margin-controls {
            grid-template-columns: 1fr;
          }

          .finance-margin-controls input,
          .finance-margin-controls select {
            width: 100%;
          }

          .finance-products-grid {
            grid-template-columns: 1fr;
          }
        }

        @container finance (max-width: 860px) {
          .finance-filter-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .finance-page :global(.stat-card) {
            min-height: 104px;
          }

          .finance-scope-tabs {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .finance-scope-tabs button {
            min-height: 54px;
            padding: 9px 8px;
          }

          .finance-scope-tabs span {
            display: none;
          }
        }

        @container finance (max-width: 680px) {
          .finance-filter-grid {
            grid-template-columns: 1fr !important;
          }

          .finance-stats-grid,
          .finance-stats-grid-secondary,
          .finance-mini-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .finance-desktop-table {
            display: none;
          }

          .finance-mobile-list {
            display: grid;
            gap: 10px;
          }

          .finance-page :global(.stat-card) {
            min-height: 96px;
            padding: 11px !important;
          }

          .finance-page :global(.stat-value) {
            font-size: 16px !important;
          }

          .finance-stat-head span {
            font-size: 10.5px;
          }
        }

        @media (max-width: 1280px) {
          .finance-stats-grid,
          .finance-stats-grid-secondary {
            grid-template-columns: repeat(2, minmax(220px, 1fr)) !important;
          }

          .finance-mini-stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }

          .finance-movements-split-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 900px) {
          .finance-filter-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .finance-filter-grid button {
            width: 100%;
          }

          .finance-scope-header {
            grid-template-columns: 1fr;
          }

          .finance-card-header {
            grid-template-columns: 1fr;
          }

          .finance-badge-row {
            justify-content: flex-start;
          }

          .finance-products-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .finance-page {
            display: grid;
            gap: 0;
            max-width: 100%;
            padding-bottom: 10px;
          }

          .finance-mobile-tabs {
            position: sticky;
            top: 0;
            z-index: 40;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 7px;
            padding: 8px;
            margin: 0 0 10px;
            border: 1px solid var(--border);
            border-radius: 16px;
            background: color-mix(in srgb, var(--surface) 92%, transparent);
            backdrop-filter: blur(12px);
          }

          .finance-mobile-tabs button {
            border: 1px solid transparent;
            border-radius: 999px;
            min-height: 34px;
            background: transparent;
            color: var(--text2);
            font-size: 11px;
            font-weight: 900;
            cursor: pointer;
          }

          .finance-mobile-tabs button.is-active {
            border-color: var(--accent);
            background: color-mix(in srgb, var(--accent) 13%, var(--surface));
            color: var(--accent);
          }

          .finance-tab-resumen .finance-margin-card,
          .finance-tab-resumen .finance-movements-split-grid {
            display: none !important;
          }

          .finance-tab-margenes .finance-summary-section,
          .finance-tab-margenes .finance-movements-split-grid {
            display: none !important;
          }

          .finance-tab-movimientos .finance-summary-section,
          .finance-tab-movimientos .finance-margin-card {
            display: none !important;
          }

          .finance-actions {
            width: 100%;
            display: grid !important;
            grid-template-columns: 1fr;
            gap: 8px !important;
          }

          .finance-actions button {
            width: 100%;
            justify-content: center;
          }

          .finance-filter-card,
          .finance-scope-card,
          .finance-margin-card,
          .finance-chart-card,
          .finance-category-card,
          .finance-product-card,
          .finance-movements-card {
            border-radius: 18px;
            overflow: hidden;
          }

          .finance-filter-card,
          .finance-scope-card,
          .finance-margin-card,
          .finance-chart-card,
          .finance-category-card,
          .finance-product-card {
            padding: 12px !important;
            margin-bottom: 12px !important;
          }

          .finance-filter-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .finance-filter-grid button {
            width: 100%;
            justify-content: center;
          }

          .finance-scope-header {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .finance-scope-header strong {
            font-size: 17px;
          }

          .finance-scope-tabs {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
          }

          .finance-scope-tabs button {
            min-height: 42px;
            border-radius: 12px;
            padding: 8px 6px;
            text-align: center;
            place-items: center;
          }

          .finance-scope-tabs b {
            font-size: 10.5px;
          }

          .finance-scope-tabs span {
            display: none;
          }

          .finance-stats-grid,
          .finance-stats-grid-secondary,
          .finance-mini-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
            margin-bottom: 10px !important;
          }

          .finance-page :global(.stat-card) {
            min-height: 92px;
            border-radius: 16px;
            padding: 10px !important;
          }

          .finance-stat-head {
            margin-bottom: 7px;
            gap: 6px;
          }

          .finance-stat-head span {
            font-size: 10px;
            line-height: 1.2;
          }

          .finance-stat-icon {
            width: 28px;
            height: 28px;
            border-radius: 9px;
          }

          .finance-page :global(.stat-value) {
            font-size: 15px !important;
            line-height: 1.15;
            overflow-wrap: anywhere;
          }

          .finance-stat-subtitle {
            font-size: 9.5px;
            margin-top: 4px;
          }

          .finance-card-header {
            grid-template-columns: 1fr;
            gap: 12px;
            margin-bottom: 14px;
          }

          .finance-card-header > div:first-child {
            width: 100%;
            min-width: 0;
          }

          .finance-card-header h3,
          .finance-title-row h3 {
            font-size: 15px;
            line-height: 1.25;
          }

          .finance-card-header p {
            font-size: 12px;
            line-height: 1.4;
          }

          .finance-margin-controls {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .finance-margin-controls input,
          .finance-margin-controls select {
            width: 100%;
          }

          .finance-desktop-table {
            display: none;
          }

          .finance-mobile-list {
            display: grid;
            gap: 10px;
          }

          .finance-mobile-item {
            border: 1px solid var(--border);
            border-radius: 16px;
            background: var(--surface2);
            padding: 12px;
            min-width: 0;
          }

          .finance-mobile-item.finance-movement-row:hover {
            transform: translateY(-1px);
            box-shadow: 0 10px 26px rgba(15, 23, 42, 0.08);
          }

          .finance-mobile-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            min-width: 0;
          }

          .finance-mobile-head > div {
            min-width: 0;
            width: 100%;
          }

          .finance-mobile-head h4 {
            margin: 8px 0 0;
            font-size: 14px;
            font-weight: 900;
            color: var(--text);
            line-height: 1.25;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .finance-mobile-head p {
            margin: 5px 0 0;
            color: var(--text3);
            font-size: 12px;
          }

          .finance-mobile-head > strong {
            flex-shrink: 0;
            font-family: var(--mono);
            font-size: 13px;
            font-weight: 900;
            text-align: right;
          }

          .finance-mobile-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }

          .finance-mobile-data {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
            margin-top: 10px;
          }

          .finance-mobile-data > div {
            display: grid;
            gap: 4px;
            border-radius: 12px;
            background: var(--surface);
            padding: 8px;
            min-width: 0;
          }

          .finance-mobile-data small {
            color: var(--text3);
            font-size: 11px;
            font-weight: 800;
          }

          .finance-mobile-data strong {
            font-family: var(--mono);
            font-size: 11px;
            text-align: left;
            overflow-wrap: anywhere;
          }

          .finance-chart-wrap {
            width: 100%;
            height: 240px;
            overflow: hidden;
          }

          .finance-category-row {
            align-items: flex-start;
            gap: 10px;
            border-radius: 14px;
          }

          .finance-category-row span:first-child {
            min-width: 0;
            overflow-wrap: anywhere;
          }

          .finance-category-row span:last-child {
            flex-shrink: 0;
            text-align: right;
          }

          .finance-products-grid {
            grid-template-columns: 1fr;
            gap: 12px;
            margin-bottom: 14px;
          }

          .finance-product-card > div:first-child {
            align-items: flex-start;
          }

          .finance-product-row {
            align-items: flex-start;
          }

          .finance-product-row span {
            min-width: 0;
            overflow-wrap: anywhere;
          }

          .finance-movements-split-grid {
            grid-template-columns: 1fr;
            gap: 12px;
            margin-bottom: 14px;
          }

          .finance-movements-card {
            padding: 12px;
          }

          .finance-movements-mobile {
            padding: 0;
          }

          .finance-movements-title {
            padding: 14px 12px 10px;
            flex-direction: column;
            gap: 8px;
          }

          .finance-movements-title h3 {
            font-size: 14px;
          }

          .finance-movements-title p {
            font-size: 12px;
          }

          .finance-pagination {
            display: grid;
            grid-template-columns: 1fr;
            padding: 12px;
          }

          .finance-pagination button {
            width: 100%;
            justify-content: center;
          }

          .modal-overlay {
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding: 0;
            background: rgba(0, 0, 0, 0.52);
          }

          .finance-modal {
            width: 100vw !important;
            max-width: 100vw !important;
            max-height: min(88dvh, 640px) !important;
            margin: 0 !important;
            border-radius: 22px 22px 0 0 !important;
            overflow: hidden !important;
            display: flex;
            flex-direction: column;
            background: var(--surface);
          }

          .finance-modal .modal-header {
            flex-shrink: 0;
            border-bottom: 1px solid var(--border);
            background: var(--surface);
          }

          .finance-modal .modal-body {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            padding: 14px !important;
            background: var(--bg);
          }

          .finance-modal .modal-body .form-group,
          .finance-modal .modal-body .finance-form-row {
            border: 1px solid var(--border);
            border-radius: 15px;
            padding: 10px;
            background: var(--surface);
          }

          .finance-modal .modal-body .finance-form-row .form-group {
            border: 0;
            padding: 0;
            background: transparent;
          }

          .finance-modal-footer {
            flex-shrink: 0;
            padding: 12px 14px calc(12px + env(safe-area-inset-bottom)) !important;
            border-top: 1px solid var(--border);
            background: var(--surface);
          }

          .finance-form-row,
          .finance-modal-footer {
            display: grid;
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .movement-detail-grid,
          .movement-sale-grid {
            grid-template-columns: 1fr;
          }

          .movement-products-card {
            padding: 12px;
            border-radius: 15px;
          }

          .movement-products-head,
          .movement-sale-card-head {
            flex-direction: column;
            gap: 8px;
          }

          .movement-products-table {
            min-width: 520px;
          }

          .movement-detail-hero h3 {
            font-size: 15px;
          }

          .movement-detail-hero strong {
            font-size: 17px;
          }

          .finance-modal-footer button {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 420px) {
          .finance-filter-card,
          .finance-scope-card,
          .finance-margin-card,
          .finance-chart-card,
          .finance-category-card,
          .finance-product-card {
            padding: 12px !important;
            border-radius: 16px;
          }

          .finance-mobile-item {
            border-radius: 14px;
            padding: 10px;
          }

          .finance-mobile-head {
            flex-direction: column;
          }

          .finance-mobile-head h4 {
            white-space: normal;
          }

          .finance-mobile-head > strong {
            text-align: left;
            font-size: 15px;
          }

          .finance-mobile-data {
            grid-template-columns: 1fr;
          }

          .finance-category-row {
            flex-direction: column;
          }

          .finance-category-row span:last-child {
            text-align: left;
          }
        }
      `}</style>
    </AppLayout>
  );
}
