/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { BusinessLocation, PaymentMethod, Product, Sale } from '@/types';
import { clientName, fmtDate, fmtMoney, normalizeArray, num } from '@/lib/helpers';
import { remitoApi, type Remito } from '@/service/remito.service';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Check,
  FileText,
  Package,
  Plus,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Printer,
  ReceiptText,
  Search,
  Send,
  Trash2,
  Truck,
  X,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const PAGE_SIZE = 10;
const DELIVERY_SKU = 'ENVIO-FLETE2';
const DEFAULT_DELIVERY_PRICE_PER_KM = 8000;

const badge = (s: string) =>
  s === 'COMPLETED' ? 'badge-green' : s === 'PENDING' ? 'badge-yellow' : 'badge-red';

const invoiceBadge = (s?: string | null) =>
  s === 'INVOICED'
    ? 'badge-green'
    : s === 'PENDING_AFIP'
      ? 'badge-yellow'
      : s === 'ERROR'
        ? 'badge-red'
        : 'badge-gray';

const methods: PaymentMethod[] = [
  'EFECTIVO',
  'TRANSFERENCIA',
  'TARJETA',
  'DEBITO',
  'CREDITO',
  'QR',
  'QR_MERCADOPAGO',
  'QR_NACION',
  'CUENTA_CORRIENTE',
];

type InvoiceType = 1 | 6 | 11;

type InvoiceModalState = {
  sale: Sale;
  tipoComprobante: InvoiceType;
  receiverDoc: string;
  condicionIVAReceptor: number;
};

type CreditNoteModalState = {
  sale: Sale;
  motivo: string;
  importe: string;
};

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
} | null;

type PaymentView = {
  method: PaymentMethod;
  amount: number;
  reference?: string | null;
  notes?: string | null;
};

type ProductView = {
  id?: string | null;
  name?: string | null;
  saleUnit?: string | null;
};

type SaleItemView = {
  id?: string;
  productId?: string | null;
  productNameSnapshot?: string | null;
  product?: ProductView | null;
  quantity?: number | null;
  quantityKg?: number | null;
  price: number;
  priceType?: string | null;
  subtotal?: number | null;
};

type InvoiceAfipView = {
  id?: string;
  tipoComprobante?: number | null;
  relatedInvoiceId?: string | null;
  creditNotes?: CreditNoteView[];
  creditNote?: CreditNoteView | null;
  relatedCreditNotes?: CreditNoteView[];
};

type CreditNoteView = {
  id?: string;
  saleId?: string;
  sale?: {
    id?: string;
  } | null;
};

type SaleUserView = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
};

type SaleExtra = Sale & {
  invoiceStatus?: string | null;
  isInvoiced?: boolean | null;
  isNoteCredit?: boolean | null;
  hasCreditNote?: boolean | null;
  stockLocation?: 'LOCAL' | 'DEPOSITO' | string | null;
  businessLocationId?: string | null;
  businessLocation?: BusinessLocation | null;
  receiptType?: 'TICKET' | 'FACTURA' | 'NOTA_CREDITO' | 'NOTA DE CREDITO' | 'NOTA DE CRÉDITO' | string | null;
  invoiceAfip?: InvoiceAfipView | null;
  invoiceAfipId?: string | null;
  invoice?: InvoiceAfipView | null;
  factura?: InvoiceAfipView | null;
  creditNoteAfip?: CreditNoteView | null;
  creditNote?: CreditNoteView | null;
  creditNotes?: CreditNoteView[];
  remitos?: Remito[];
  remito?: Remito | null;
  transportName?: string | null;
  transportCuit?: string | null;
  packagesCount?: number | null;
  declaredValue?: number | null;
  quotationExpiresAt?: string | null;
  deliveryMethod?: 'PICKUP' | 'LOCAL_DELIVERY' | string | null;
  deliveryStatus?: string | null;
  deliveryAddressSnapshot?: string | null;
  deliveryDistanceKm?: number | null;
  deliveryPricePerKm?: number | null;
  deliveryCost?: number | null;
  payments?: PaymentView[];
  items?: SaleItemView[];
  userId?: string | null;
  isWebSale?: boolean | null;
  sellerId?: string | null;
  createdById?: string | null;
  userName?: string | null;
  sellerName?: string | null;
  createdByName?: string | null;
  user?: SaleUserView | null;
  seller?: SaleUserView | null;
  createdBy?: SaleUserView | null;
  employee?: SaleUserView | null;
  client?: (NonNullable<Sale['client']> & {
    dni?: string | null;
    category?: string | null;
  }) | null;
};

type AfipInvoiceResponse = {
  invoiceStatus?: string;
  cae?: string;
  factura?: {
    cae?: string;
  };
  content?: {
    cae?: string;
  };
  invoice?: {
    cae?: string;
  };
};

type PendingAfipSaleNotification = {
  id: string;
  total?: number | string | null;
  status?: string | null;
  invoiceStatus?: string | null;
  afipLastError?: string | null;
  nextRetryAt?: string | null;
  retryCount?: number | null;
  createdAt?: string | null;
  client?: {
    nombre?: string | null;
    apellido?: string | null;
  } | null;
};

type PendingAfipNotification = {
  ok?: boolean;
  hasPendingAfip: boolean;
  count: number;
  message?: string;
  sales?: PendingAfipSaleNotification[];
};

type CreditNoteResponse = {
  message?: string;
  notaCredito?: {
    cae?: string;
  };
};

type SalesStats = {
  totalCount?: number;
  pendingCount?: number;
  completedCount?: number;
  cancelledCount?: number;
  confirmedTotal?: number;
  debt?: number;
};

type SalesFetchResult = {
  items: Sale[];
  serverPaginated: boolean;
  totalItems: number;
  totalPages: number;
  page: number;
  stats?: SalesStats | null;
};

type DeliveryCostOption = {
  key: 'SHORT' | 'CALCULATED' | 'LONG' | 'AVERAGE';
  label: string;
  distanceKm: number;
  deliveryCost: number;
};

type DeliveryCalculation = {
  distanceKm: number;
  pricePerKm: number;
  deliveryCost: number;
  durationMinutes?: number | null;
  straightDistanceKm?: number | null;
  source?: 'GOOGLE_ROUTES' | 'COORDINATES_FALLBACK';
  businessLocationId: string;
  businessLocationName: string;
  clientId: string;
  clientName: string;
  originAddress?: string;
  destinationAddress?: string;
  deliveryAddressSnapshot?: string;
  options?: DeliveryCostOption[];
  average?: DeliveryCostOption;
  selectedOptionKey?: DeliveryCostOption['key'];
};

type SaleEditLine = {
  key: string;
  productId: string;
  name: string;
  saleUnit?: string | null;
  quantity: number;
  quantityKg?: number | null;
  price: number;
  priceType?: string | null;
  sku?: string | null;
  isDelivery?: boolean;
};

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.message ??
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.error ??
    (error as { message?: string })?.message ??
    fallback
  );
}

async function getBlobErrorMessage(error: unknown, fallback: string) {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;

  if (responseData instanceof Blob) {
    const text = await responseData.text();

    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string };
      return parsed.message || parsed.error || fallback;
    } catch {
      return text || fallback;
    }
  }

  return getErrorMessage(error, fallback);
}

function onlyNumbers(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;

    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }

  return 0;
}


function detectDocType(doc: string) {
  const clean = onlyNumbers(doc);

  if (!clean || clean === '0') {
    return {
      tipoDoc: 99,
      nroDoc: 0,
    };
  }

  if (clean.length === 7 || clean.length === 8) {
    return {
      tipoDoc: 96,
      nroDoc: Number(clean),
    };
  }

  if (clean.length === 11) {
    const prefix = clean.slice(0, 2);

    if (['20', '23', '24', '27'].includes(prefix)) {
      return {
        tipoDoc: 86,
        nroDoc: Number(clean),
      };
    }

    return {
      tipoDoc: 80,
      nroDoc: Number(clean),
    };
  }

  return null;
}

function getSaleInvoiceStatus(sale: Sale) {
  const s = sale as SaleExtra;

  if (s.invoiceStatus) return s.invoiceStatus;
  if (s.isInvoiced) return 'INVOICED';

  return 'NONE';
}

function isSaleInvoiced(sale: Sale) {
  const s = sale as SaleExtra;
  return Boolean(s.isInvoiced) || s.invoiceStatus === 'INVOICED';
}

function isCreditNoteSale(sale: Sale) {
  const saleExtra = sale as SaleExtra;
  const receiptType = String(saleExtra.receiptType ?? '');

  return Boolean(
    saleExtra.isNoteCredit ||
      receiptType === 'NOTA_CREDITO' ||
      receiptType === 'NOTA DE CREDITO' ||
      receiptType === 'NOTA DE CRÉDITO' ||
      saleExtra.invoiceAfip?.relatedInvoiceId ||
      [3, 8, 13].includes(Number(saleExtra.invoiceAfip?.tipoComprobante))
  );
}

function hasCreditNote(sale: Sale) {
  const saleExtra = sale as SaleExtra;

  return Boolean(
    saleExtra.hasCreditNote ||
      saleExtra.creditNoteAfip ||
      saleExtra.creditNote ||
      (saleExtra.creditNotes?.length ?? 0) > 0 ||
      (saleExtra.invoiceAfip?.creditNotes?.length ?? 0) > 0 ||
      saleExtra.invoiceAfip?.creditNote ||
      (saleExtra.invoiceAfip?.relatedCreditNotes?.length ?? 0) > 0
  );
}

function canEmitCreditNote(sale: Sale) {
  return (
    isSaleInvoiced(sale) &&
    sale.status !== 'CANCELLED' &&
    !isCreditNoteSale(sale) &&
    !hasCreditNote(sale)
  );
}

function getCreditNoteSaleId(sale: Sale) {
  const saleExtra = sale as SaleExtra;

  if (isCreditNoteSale(sale)) {
    return sale.id;
  }

  const firstCreditNote =
    saleExtra.invoiceAfip?.creditNotes?.[0] ||
    saleExtra.creditNotes?.[0] ||
    saleExtra.creditNoteAfip ||
    saleExtra.creditNote ||
    saleExtra.invoiceAfip?.creditNote ||
    saleExtra.invoiceAfip?.relatedCreditNotes?.[0];

  return firstCreditNote?.saleId || firstCreditNote?.sale?.id || firstCreditNote?.id || null;
}

function canDownloadCreditNote(sale: Sale) {
  return Boolean(isCreditNoteSale(sale) || getCreditNoteSaleId(sale));
}

function getSaleRemitos(sale: Sale): Remito[] {
  const saleExtra = sale as SaleExtra;

  if (Array.isArray(saleExtra.remitos)) {
    return saleExtra.remitos.filter((r) => r.status !== 'CANCELLED');
  }

  if (saleExtra.remito && saleExtra.remito.status !== 'CANCELLED') {
    return [saleExtra.remito];
  }

  return [];
}

function hasRemito(sale: Sale) {
  return getSaleRemitos(sale).length > 0;
}

function canEmitRemito(sale: Sale) {
  return sale.status === 'COMPLETED' || isSaleInvoiced(sale);
}

function defaultInvoiceTypeForSale(sale: Sale): InvoiceType {
  const client = (sale as SaleExtra).client;

  if (!client) return 11;

  const category = String(client.category ?? '').toLowerCase();

  if (category.includes('mayorista') || category.includes('cliente')) {
    return 6;
  }

  return 11;
}

function getSaleProductsForAfip(sale: Sale) {
  const items = (sale as SaleExtra).items ?? [];

  return items.map((item) => {
    const quantityKg =
      item.quantityKg !== null && item.quantityKg !== undefined ? num(item.quantityKg) : undefined;

    const quantity = quantityKg !== undefined && quantityKg > 0 ? quantityKg : num(item.quantity || 1);
    const price = num(item.price);

    return {
      name: item.productNameSnapshot || item.product?.name || 'Producto',
      quantity,
      quantityKg,
      price,
      subtotal:
        item.subtotal !== undefined && item.subtotal !== null ? num(item.subtotal) : quantity * price,
    };
  });
}

function getSalePaymentLabel(sale: Sale) {
  const saleExtra = sale as SaleExtra;

  if (saleExtra.payments?.length) {
    return saleExtra.payments
      .map((p) => `${p.method}: ${fmtMoney(num(p.amount))}`)
      .join(' | ');
  }

  return sale.paymentMethod;
}

function getSaleSellerLabel(sale: Sale) {
  const saleExtra = sale as SaleExtra;

  if (saleExtra.isWebSale) {
    return 'Venta desde la Web';
  }

  const name =
    saleExtra.user?.name ||
    saleExtra.seller?.name ||
    saleExtra.createdBy?.name ||
    saleExtra.employee?.name ||
    saleExtra.userName ||
    saleExtra.sellerName ||
    saleExtra.createdByName;

  if (name) return name;

  const email =
    saleExtra.user?.email ||
    saleExtra.seller?.email ||
    saleExtra.createdBy?.email ||
    saleExtra.employee?.email;

  if (email) return email;

  const id = saleExtra.userId || saleExtra.sellerId || saleExtra.createdById;

  if (id) return `Usuario #${String(id).slice(-8)}`;

  return 'Sin vendedor';
}

function getStockLocationLabel(sale: Sale) {
  const location = String((sale as SaleExtra).stockLocation ?? '').toUpperCase();

  if (location === 'LOCAL') return 'Mayorista';
  if (location === 'DEPOSITO') return 'Minorista';

  return 'Sin dato';
}

function getStockLocationBadgeClass(sale: Sale) {
  const location = String((sale as SaleExtra).stockLocation ?? '').toUpperCase();

  if (location === 'LOCAL') return 'badge-green';
  if (location === 'DEPOSITO') return 'badge-yellow';

  return 'badge-gray';
}

function countsAsMoney(sale: Sale) {
  return sale.status !== 'CANCELLED' && (sale.status === 'COMPLETED' || isSaleInvoiced(sale));
}

function canEditSaleItems(sale: Sale) {
  return sale.status === 'PENDING' && !isSaleInvoiced(sale);
}

function isDeliveryProduct(product: Product | any) {
  return String((product as any)?.sku ?? '').trim().toUpperCase() === DELIVERY_SKU;
}

function normalizeEditPriceType(value?: string | null) {
  const raw = String(value ?? '').trim().toUpperCase();

  if (['WHOLESALE', 'WHOLESALEPRICE', 'WHOLESALE_PRICE', 'MAYORISTA'].includes(raw)) {
    return 'WHOLESALE_PRICE';
  }

  if (['MANUAL', 'CUSTOM', 'CUSTOM_PRICE'].includes(raw)) {
    return 'MANUAL';
  }

  if (['PRICE', 'RETAIL', 'RETAIL_PRICE', 'MINORISTA', 'PUBLICO', 'PÚBLICO'].includes(raw)) {
    return 'PRICE';
  }

  return null;
}

function getEditSaleDefaultPriceType(sale?: Sale | null) {
  const stockLocation = String((sale as SaleExtra | null)?.stockLocation ?? '').toUpperCase();

  if (stockLocation === 'LOCAL') return 'WHOLESALE_PRICE';
  if (stockLocation === 'DEPOSITO') return 'PRICE';

  const category = String((sale as SaleExtra | null)?.client?.category ?? '').toLowerCase();
  return category.includes('mayorista') ? 'WHOLESALE_PRICE' : 'PRICE';
}

function getProductEditPrice(product: Product, priceType: string | null = 'PRICE') {
  const productAny = product as Product & {
    saleUnit?: string | null;
    price?: number | null;
    pricePerKg?: number | null;
    wholesalePrice?: number | null;
    wholesalePricePerKg?: number | null;
  };

  if (isDeliveryProduct(productAny)) return 0;

  const isKg = productAny.saleUnit === 'KG';

  if (priceType === 'WHOLESALE_PRICE') {
    return isKg
      ? firstNumber(productAny.wholesalePricePerKg, productAny.pricePerKg, productAny.price)
      : num(productAny.wholesalePrice, productAny.price);
  }

  return isKg ? num(productAny.pricePerKg, productAny.price) : num(productAny.price);
}

function productEditName(product: Product) {
  return String((product as Product & { name?: string | null }).name ?? 'Producto');
}

function getEditPriceLabel(priceType?: string | null) {
  const normalized = normalizeEditPriceType(priceType);

  if (normalized === 'WHOLESALE_PRICE') return 'Mayorista';
  if (normalized === 'MANUAL') return 'Manual';
  return 'Minorista';
}

function clientHasCoordinates(client?: any | null) {
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

function buildClientAddress(client?: any | null) {
  if (!client) return '';

  const street = [client.addressStreet, client.addressNumber].filter(Boolean).join(' ');
  const floor = [
    client.addressFloor ? `Piso ${client.addressFloor}` : '',
    client.addressApartment ? `Dto ${client.addressApartment}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const city = [client.addressCity, client.addressProvince, client.addressPostalCode]
    .filter(Boolean)
    .join(', ');

  return [street, floor, city, client.addressNotes].filter(Boolean).join(' - ');
}

function deliverySourceLabel(source?: DeliveryCalculation['source'] | null) {
  if (source === 'GOOGLE_ROUTES') return 'Google Routes';
  if (source === 'COORDINATES_FALLBACK') return 'Estimado';
  return 'Calculado';
}

function formatDurationMinutes(minutes?: number | null) {
  const value = num(minutes);
  if (value <= 0) return '';
  if (value < 60) return `${Math.round(value)} min`;

  const hours = Math.floor(value / 60);
  const remainingMinutes = Math.round(value % 60);
  return `${hours} h${remainingMinutes ? ` ${remainingMinutes} min` : ''}`;
}

function getQuotationExpirationLabel(sale: Sale) {
  const saleExtra = sale as SaleExtra;

  if (!saleExtra.quotationExpiresAt) return null;

  return fmtDate(String(saleExtra.quotationExpiresAt));
}

function normalizeSalesFetchResponse(data: any, fallbackPage: number): SalesFetchResult {
  if (Array.isArray(data)) {
    const items = normalizeArray<Sale>(data);

    return {
      items,
      serverPaginated: false,
      totalItems: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / PAGE_SIZE)),
      page: fallbackPage,
      stats: null,
    };
  }

  const items = normalizeArray<Sale>(
    data?.items ?? data?.sales ?? data?.data ?? data?.results ?? data?.rows ?? []
  );

  const meta = data?.meta ?? data?.pagination ?? data;
  const totalItems = firstNumber(meta?.totalItems, meta?.total, meta?.count, items.length);
  const totalPages = Math.max(
    1,
    firstNumber(meta?.totalPages, meta?.pages, Math.ceil(totalItems / PAGE_SIZE))
  );
  const page = Math.max(1, firstNumber(meta?.page, meta?.currentPage, fallbackPage));

  return {
    items,
    serverPaginated: Boolean(data?.meta || data?.pagination || meta?.total || meta?.totalItems || meta?.count),
    totalItems,
    totalPages,
    page,
    stats: data?.stats ?? data?.summary ?? null,
  };
}

async function fetchSales(params?: { page?: number; limit?: number; search?: string; status?: string }) {
  const r = await api.get('/sales', { params });
  return normalizeSalesFetchResponse(r.data, params?.page ?? 1);
}

export default function VentasPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [detail, setDetail] = useState<Sale | null>(null);
  const [payEdit, setPayEdit] = useState<Sale | null>(null);
  const [mobileActionsSale, setMobileActionsSale] = useState<Sale | null>(null);
  const [mounted, setMounted] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const [serverPaginated, setServerPaginated] = useState(false);
  const [serverTotalItems, setServerTotalItems] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverStats, setServerStats] = useState<SalesStats | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [businessLocations, setBusinessLocations] = useState<BusinessLocation[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [editItemsSale, setEditItemsSale] = useState<Sale | null>(null);
  const [editLines, setEditLines] = useState<SaleEditLine[]>([]);
  const [editProductSearch, setEditProductSearch] = useState('');
  const [savingItems, setSavingItems] = useState(false);
  const [editDeliveryEnabled, setEditDeliveryEnabled] = useState(false);
  const [editDeliveryDistanceKm, setEditDeliveryDistanceKm] = useState('');
  const [editDeliveryPricePerKm, setEditDeliveryPricePerKm] = useState(String(DEFAULT_DELIVERY_PRICE_PER_KM));
  const [editBusinessLocationId, setEditBusinessLocationId] = useState('');
  const [editDeliveryCalculation, setEditDeliveryCalculation] = useState<DeliveryCalculation | null>(null);
  const [editCalculatingDelivery, setEditCalculatingDelivery] = useState(false);

  const [payments, setPayments] = useState<PaymentView[]>([]);

  const [invoiceModal, setInvoiceModal] = useState<InvoiceModalState | null>(null);
  const [creditNoteModal, setCreditNoteModal] = useState<CreditNoteModalState | null>(null);
  const [quotationModal, setQuotationModal] = useState<Sale | null>(null);
  const [comprobanteModal, setComprobanteModal] = useState<Sale | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [invoicingId, setInvoicingId] = useState<string | null>(null);
  const [creditNoteLoadingId, setCreditNoteLoadingId] = useState<string | null>(null);
  const [quotationLoadingId, setQuotationLoadingId] = useState<string | null>(null);
  const [comprobanteLoadingId, setComprobanteLoadingId] = useState<string | null>(null);
  const [printingTicketId, setPrintingTicketId] = useState<string | null>(null);

  const [remitoLoadingId, setRemitoLoadingId] = useState<string | null>(null);
  const [openingRemitoId, setOpeningRemitoId] = useState<string | null>(null);

  const [pendingAfipNotification, setPendingAfipNotification] =
    useState<PendingAfipNotification | null>(null);
  const [checkingPendingAfip, setCheckingPendingAfip] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let alive = true;

    api
      .get('/auth/me')
      .then((response) => {
        if (!alive) return;
        const user = response.data?.user ?? response.data?.content ?? response.data;
        setCurrentUserRole(String(user?.role ?? '').toUpperCase() || null);
      })
      .catch(() => {
        if (!alive) return;
        setCurrentUserRole(null);
      });

    return () => {
      alive = false;
    };
  }, []);
  const isAdmin = currentUserRole === 'ADMIN';

  const load = async (showSuccess = false) => {
    setLoading(true);

    try {
      const result = await fetchSales({
        page: currentPage,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: status || undefined,
      });

      setSales(result.items);
      setServerPaginated(result.serverPaginated);
      setServerTotalItems(result.totalItems);
      setServerTotalPages(result.totalPages);
      setServerStats(result.stats ?? null);

      if (showSuccess) {
        toast.success('Ventas actualizadas');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar ventas');
    } finally {
      setLoading(false);
    }
  };

  const openFirstPendingAfipSale = async (saleId?: string | null) => {
    toast.dismiss('pending-afip-notification');

    if (!saleId) {
      toast.error('No encontré la venta pendiente de AFIP');
      return;
    }

    setStatus('');
    setSearch(saleId.slice(-8));
    setCurrentPage(1);

    try {
      const response = await api.get(`/sales/${saleId}`);
      const sale = response.data?.sale ?? response.data?.content ?? response.data;

      if (sale?.id) {
        setDetail(sale as Sale);
      }
    } catch (error) {
      console.error(error);
      toast.error('No pude abrir el detalle. Te dejé filtrada la venta pendiente.');
    } finally {
      void load();
    }
  };

  const loadPendingAfipNotification = async (showToast = false) => {
    try {
      setCheckingPendingAfip(true);

      const response = await api.get('/afip/pending-afip');
      const data = response.data as PendingAfipNotification;

      setPendingAfipNotification(data);

      if (data?.hasPendingAfip && data.count > 0) {
        const firstSale = data.sales?.[0] ?? null;

        toast.custom(
          () => (
            <div
              style={{
                width: 'min(420px, calc(100vw - 28px))',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: 18,
                background: 'var(--surface)',
                boxShadow: '0 18px 45px rgba(15, 23, 42, 0.18)',
                padding: 14,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    background: 'rgba(245, 158, 11, 0.14)',
                    color: 'var(--warn)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle size={18} />
                </span>

                <div style={{ minWidth: 0, display: 'grid', gap: 3 }}>
                  <b style={{ color: 'var(--text)', fontSize: 14 }}>
                    Ventas pendientes de AFIP
                  </b>

                  <small style={{ color: 'var(--text2)', lineHeight: 1.4 }}>
                    {data.message ||
                      `Hay ${data.count} venta${data.count === 1 ? '' : 's'} pendiente${data.count === 1 ? '' : 's'} de facturar.`}
                  </small>

                  {firstSale && (
                    <small style={{ color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                      Primera: #{firstSale.id.slice(-8)}
                    </small>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => toast.dismiss('pending-afip-notification')}
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => void openFirstPendingAfipSale(firstSale?.id)}
                >
                  Ver para facturar
                </button>
              </div>
            </div>
          ),
          {
            id: 'pending-afip-notification',
            duration: 12000,
          }
        );
      } else {
        toast.dismiss('pending-afip-notification');

        if (showToast) {
          toast.success('No hay ventas pendientes de AFIP');
        }
      }
    } catch (error) {
      console.error(error);

      if (showToast) {
        toast.error(getErrorMessage(error, 'No se pudo consultar ventas pendientes de AFIP'));
      }
    } finally {
      setCheckingPendingAfip(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearch, status]);


  useEffect(() => {
    void loadPendingAfipNotification();

    const interval = window.setInterval(() => {
      void loadPendingAfipNotification();
    }, 60000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (serverPaginated) return sales;

    const cleanSearch = debouncedSearch.toLowerCase();

    return sales.filter(
      (s) =>
        (!status || s.status === status) &&
        (!cleanSearch ||
          s.id.toLowerCase().includes(cleanSearch) ||
          clientName(s.client).toLowerCase().includes(cleanSearch))
    );
  }, [sales, debouncedSearch, status, serverPaginated]);

  const totalPages = serverPaginated
    ? serverTotalPages
    : Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paginatedSales = useMemo(() => {
    if (serverPaginated) return filtered;

    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage, serverPaginated]);

  const totalFilteredItems = serverPaginated ? serverTotalItems : filtered.length;
  const pageStart = totalFilteredItems ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, totalFilteredItems);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, status]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const visibleMoneySales = sales.filter(countsAsMoney);
  const fallbackTotal = visibleMoneySales.reduce((a, s) => a + num(s.total), 0);
  const fallbackDebt = visibleMoneySales.reduce((a, s) => a + num(s.accountDebtAmount), 0);

  const total =
    serverStats?.confirmedTotal !== undefined && serverStats?.confirmedTotal !== null
      ? num(serverStats.confirmedTotal)
      : fallbackTotal;

  const debt =
    serverStats?.debt !== undefined && serverStats?.debt !== null
      ? num(serverStats.debt)
      : fallbackDebt;

  const salesCount = num(serverStats?.totalCount, serverPaginated ? serverTotalItems : sales.length);
  const pendingCount = num(
    serverStats?.pendingCount,
    sales.filter((s) => s.status === 'PENDING').length
  );
  const completedCount = num(
    serverStats?.completedCount,
    sales.filter((s) => s.status === 'COMPLETED').length
  );
  const cancelledCount = num(
    serverStats?.cancelledCount,
    sales.filter((s) => s.status === 'CANCELLED').length
  );

  const firstPendingAfipSale = pendingAfipNotification?.sales?.[0] ?? null;
  const firstPendingAfipClient = firstPendingAfipSale?.client
    ? [firstPendingAfipSale.client.nombre, firstPendingAfipSale.client.apellido]
        .filter(Boolean)
        .join(' ')
    : '';

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

  const setSaleStatus = async (s: Sale, next: Sale['status']) => {
    if (next === 'CANCELLED') {
      setConfirmModal({
        title: 'Cancelar venta',
        message: `¿Cancelar venta #${s.id.slice(-8)} y revertir stock/deuda?`,
        confirmText: 'Cancelar venta',
        danger: true,
        onConfirm: async () => {
          const toastId = toast.loading('Cancelando venta...');

          try {
            await api.patch(`/sales/${s.id}/status`, { status: next });
            await load();
            toast.success('Venta cancelada correctamente', { id: toastId });
          } catch (error) {
            toast.error(getErrorMessage(error, 'No se pudo cancelar la venta'), { id: toastId });
          }
        },
      });

      return;
    }

    const toastId = toast.loading('Actualizando venta...');

    try {
      await api.patch(`/sales/${s.id}/status`, { status: next });
      await load();
      toast.success('Venta actualizada correctamente', { id: toastId });
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo actualizar la venta'), { id: toastId });
    }
  };

  const printTicket = async (sale: Sale) => {
    try {
      setPrintingTicketId(sale.id);

      const toastId = toast.loading('Enviando ticket a impresión...');
      await api.post(`/tickets/sale/${sale.id}/print`);
      toast.success('Ticket enviado a impresión', { id: toastId });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'No se pudo imprimir el ticket'));
    } finally {
      setPrintingTicketId(null);
    }
  };

  const createRemito = async (sale: Sale) => {
    if (!canEmitRemito(sale)) {
      toast.error('El remito solo se puede emitir si la venta está completada o facturada');
      return;
    }

    if (sale.status === 'CANCELLED') {
      toast.error('No se puede emitir remito de una venta cancelada');
      return;
    }

    setConfirmModal({
      title: 'Generar remito',
      message:
        `¿Generar remito para la venta #${sale.id.slice(-8)}?\n\n` +
        `Cliente: ${clientName(sale.client)}\n` +
        `Total declarado: ${fmtMoney(num(sale.total))}`,
      confirmText: 'Generar remito',
      danger: false,
      onConfirm: async () => {
        const saleExtra = sale as SaleExtra;
        const toastId = toast.loading('Generando remito...');

        try {
          setRemitoLoadingId(sale.id);

          const remito = await remitoApi.createFromSale(sale.id, {
            placeOfIssue: 'VILLA GENERAL BELGRANO',
            saleCondition: getSalePaymentLabel(sale),
            transportName: saleExtra.transportName || '',
            transportCuit: saleExtra.transportCuit || '',
            packagesCount: saleExtra.packagesCount ?? 1,
            declaredValue: saleExtra.declaredValue ?? sale.total,
            observations: 'Remito generado desde venta',
          });

          await load();

          toast.success(`Remito generado correctamente: ${remito.fullNumber}`, { id: toastId });
        } catch (error: unknown) {
          toast.error(getErrorMessage(error, 'No se pudo generar el remito'), { id: toastId });
        } finally {
          setRemitoLoadingId(null);
        }
      },
    });
  };

  const openRemitoPdf = async (sale: Sale) => {
    try {
      setOpeningRemitoId(sale.id);

      const localRemitos = getSaleRemitos(sale);
      const localRemito = localRemitos.find((r) => r.status !== 'CANCELLED');

      if (localRemito?.id) {
        await remitoApi.downloadPdf(localRemito.id);
        toast.success('Descargando remito');
        return;
      }

      const remitos = await remitoApi.getBySaleId(sale.id);
      const remito = remitos.find((r) => r.status !== 'CANCELLED');

      if (!remito) {
        toast.error('Esta venta todavía no tiene remito emitido');
        return;
      }

      await remitoApi.downloadPdf(remito.id);
      toast.success('Descargando remito');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'No se pudo descargar el remito'));
    } finally {
      setOpeningRemitoId(null);
    }
  };

  const getQuotationPdfBlob = async (sale: Sale) => {
    const response = await api.get(`/sales/${sale.id}/cotizacion-pdf`, {
      responseType: 'blob',
    });

    const contentType = String(response.headers['content-type'] ?? '');

    if (!contentType.includes('application/pdf')) {
      const errorText = await response.data.text();

      try {
        const parsed = JSON.parse(errorText) as { message?: string; error?: string };
        throw new Error(parsed.message || parsed.error || 'El backend no devolvió un PDF');
      } catch {
        throw new Error(errorText || 'El backend no devolvió un PDF válido');
      }
    }

    return new Blob([response.data], {
      type: 'application/pdf',
    });
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const downloadQuotation = async (sale: Sale) => {
    if (sale.status !== 'PENDING') {
      toast.error('Solo se puede descargar cotización de una venta pendiente');
      return;
    }

    try {
      setQuotationLoadingId(sale.id);

      const toastId = toast.loading('Generando cotización...');

      const blob = await getQuotationPdfBlob(sale);

      downloadBlob(blob, `cotizacion-${sale.id}.pdf`);

      setQuotationModal(null);
      await load();
      toast.success('Cotización descargada', { id: toastId });
    } catch (error: unknown) {
      const message = await getBlobErrorMessage(error, 'No se pudo descargar la cotización.');
      toast.error(message);
    } finally {
      setQuotationLoadingId(null);
    }
  };

  const shareQuotationPdfWhatsapp = async (sale: Sale) => {
    if (sale.status !== 'PENDING') {
      toast.error('Solo se puede enviar cotización de una venta pendiente');
      return;
    }

    try {
      setQuotationLoadingId(sale.id);

      const toastId = toast.loading('Generando cotización para WhatsApp...');

      const blob = await getQuotationPdfBlob(sale);
      const filename = `cotizacion-${sale.id.slice(-8)}.pdf`;
      const file = new File([blob], filename, {
        type: 'application/pdf',
      });

      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };

      const shareData: ShareData = {
        title: `Cotización #${sale.id.slice(-8)}`,
        text: `Hola, te envío la cotización en PDF. Total: ${fmtMoney(sale.total)}`,
        files: [file],
      };

      if (navigator.share && (!nav.canShare || nav.canShare(shareData))) {
        await navigator.share(shareData);

        setQuotationModal(null);
        await load();

        toast.success('Elegí WhatsApp para enviar la cotización PDF', { id: toastId });
        return;
      }

      downloadBlob(blob, filename);

      toast.error(
        'Este navegador no permite enviar PDFs directo por WhatsApp. Te descargué el PDF para adjuntarlo manualmente.',
        { id: toastId }
      );
    } catch (error: unknown) {
      const message = await getBlobErrorMessage(error, 'No se pudo compartir la cotización PDF.');
      toast.error(message);
    } finally {
      setQuotationLoadingId(null);
    }
  };

  const getComprobantePdfBlob = async (sale: Sale) => {
    const response = await api.get(`/sales/${sale.id}/comprobante-pdf`, {
      responseType: 'blob',
    });

    const contentType = String(response.headers['content-type'] ?? '');

    if (!contentType.includes('application/pdf')) {
      const errorText = await response.data.text();

      try {
        const parsed = JSON.parse(errorText) as { message?: string; error?: string };
        throw new Error(parsed.message || parsed.error || 'El backend no devolvió un PDF');
      } catch {
        throw new Error(errorText || 'El backend no devolvió un PDF válido');
      }
    }

    return new Blob([response.data], {
      type: 'application/pdf',
    });
  };

  const downloadComprobante = async (sale: Sale) => {
    if (sale.status !== 'COMPLETED' || isSaleInvoiced(sale)) {
      toast.error('Solo se puede descargar el comprobante de una venta confirmada y sin facturar');
      return;
    }

    try {
      setComprobanteLoadingId(sale.id);

      const toastId = toast.loading('Generando comprobante...');

      const blob = await getComprobantePdfBlob(sale);

      downloadBlob(blob, `comprobante-${sale.id}.pdf`);

      setComprobanteModal(null);
      toast.success('Comprobante descargado', { id: toastId });
    } catch (error: unknown) {
      const message = await getBlobErrorMessage(error, 'No se pudo descargar el comprobante.');
      toast.error(message);
    } finally {
      setComprobanteLoadingId(null);
    }
  };

  const shareComprobantePdfWhatsapp = async (sale: Sale) => {
    if (sale.status !== 'COMPLETED' || isSaleInvoiced(sale)) {
      toast.error('Solo se puede enviar el comprobante de una venta confirmada y sin facturar');
      return;
    }

    try {
      setComprobanteLoadingId(sale.id);

      const toastId = toast.loading('Generando comprobante para WhatsApp...');

      const blob = await getComprobantePdfBlob(sale);
      const filename = `comprobante-${sale.id.slice(-8)}.pdf`;
      const file = new File([blob], filename, {
        type: 'application/pdf',
      });

      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };

      const shareData: ShareData = {
        title: `Comprobante #${sale.id.slice(-8)}`,
        text: `Hola, te envío el comprobante de tu compra. Total: ${fmtMoney(sale.total)}`,
        files: [file],
      };

      if (navigator.share && (!nav.canShare || nav.canShare(shareData))) {
        await navigator.share(shareData);

        setComprobanteModal(null);

        toast.success('Elegí WhatsApp para enviar el comprobante PDF', { id: toastId });
        return;
      }

      downloadBlob(blob, filename);

      toast.error(
        'Este navegador no permite enviar PDFs directo por WhatsApp. Te descargué el PDF para adjuntarlo manualmente.',
        { id: toastId }
      );
    } catch (error: unknown) {
      const message = await getBlobErrorMessage(error, 'No se pudo compartir el comprobante PDF.');
      toast.error(message);
    } finally {
      setComprobanteLoadingId(null);
    }
  };

  const openPayments = (s: Sale) => {
    const saleExtra = s as SaleExtra;

    setPayEdit(s);

    setPayments(
      (saleExtra.payments?.length
        ? saleExtra.payments
        : [
            {
              method: s.paymentMethod,
              amount: s.paymentMethod === 'CUENTA_CORRIENTE' ? 0 : s.total,
            },
          ]
      ).map((p) => ({
        method: p.method,
        amount: num(p.amount),
        reference: p.reference ?? '',
        notes: p.notes ?? '',
      }))
    );
  };

  const savePayments = async () => {
    if (!payEdit) return;

    const toastId = toast.loading('Guardando pagos...');

    try {
      await api.patch(`/sales/${payEdit.id}/payments`, {
        setAsPrimary: true,
        payments,
      });

      setPayEdit(null);
      await load();

      toast.success('Pagos actualizados correctamente', { id: toastId });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'No se pudieron guardar los pagos'), { id: toastId });
    }
  };


  const loadProductsForSaleEdit = async () => {
    if ((products.length && businessLocations.length) || loadingProducts) {
      return { products, businessLocations };
    }

    setLoadingProducts(true);

    try {
      const [productsResponse, locationsResponse] = await Promise.all([
        products.length ? Promise.resolve({ data: products }) : api.get('/products'),
        businessLocations.length
          ? Promise.resolve({ data: businessLocations })
          : api.get('/business-locations'),
      ]);

      const nextProducts = normalizeArray<Product>(productsResponse.data).filter(
        (p: any) => p.isActive !== false
      );
      const nextLocations = normalizeArray<BusinessLocation>(locationsResponse.data).filter(
        (location: any) => location.isActive !== false
      );

      setProducts(nextProducts);
      setBusinessLocations(nextLocations);

      return { products: nextProducts, businessLocations: nextLocations };
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron cargar los datos para editar la venta');
      return { products, businessLocations };
    } finally {
      setLoadingProducts(false);
    }
  };

  const openItemsEditor = async (sale: Sale) => {
    if (!canEditSaleItems(sale)) {
      toast.error('Solo se puede editar una venta pendiente y sin factura');
      return;
    }

    const saleExtra = sale as SaleExtra;
    const editData = await loadProductsForSaleEdit();
    const defaultBusinessLocation =
      editData.businessLocations.find((location: any) => location.id === saleExtra.businessLocationId) ??
      editData.businessLocations.find((location: any) => location.isDefault) ??
      editData.businessLocations[0] ??
      null;

    setEditItemsSale(sale);
    setEditProductSearch('');
    const deliveryCost = num(saleExtra.deliveryCost);
    const hasDeliveryData =
      String(saleExtra.deliveryMethod ?? '').toUpperCase() === 'LOCAL_DELIVERY' || deliveryCost > 0;

    setEditDeliveryEnabled(hasDeliveryData);
    setEditDeliveryDistanceKm(
      saleExtra.deliveryDistanceKm !== null && saleExtra.deliveryDistanceKm !== undefined
        ? String(saleExtra.deliveryDistanceKm)
        : ''
    );
    setEditDeliveryPricePerKm(
      saleExtra.deliveryPricePerKm !== null && saleExtra.deliveryPricePerKm !== undefined
        ? String(saleExtra.deliveryPricePerKm)
        : String(DEFAULT_DELIVERY_PRICE_PER_KM)
    );
    setEditBusinessLocationId(defaultBusinessLocation?.id ?? '');
    setEditDeliveryCalculation(
      hasDeliveryData && deliveryCost > 0
        ? {
            distanceKm: num(saleExtra.deliveryDistanceKm),
            pricePerKm: num(saleExtra.deliveryPricePerKm, DEFAULT_DELIVERY_PRICE_PER_KM),
            deliveryCost,
            businessLocationId: defaultBusinessLocation?.id ?? saleExtra.businessLocationId ?? '',
            businessLocationName: defaultBusinessLocation?.name ?? saleExtra.businessLocation?.name ?? 'Ubicación',
            clientId: saleExtra.client?.id ?? '',
            clientName: clientName(saleExtra.client),
            deliveryAddressSnapshot: saleExtra.deliveryAddressSnapshot ?? buildClientAddress(saleExtra.client),
          }
        : null
    );

    setEditLines(
      (saleExtra.items ?? [])
        .map((item, index) => {
          const productSku = String((item.product as any)?.sku ?? '');
          const isDelivery = productSku.trim().toUpperCase() === DELIVERY_SKU;

          return {
            key: item.id || `${item.productId || item.product?.id || 'item'}-${index}`,
            productId: String(item.productId || item.product?.id || ''),
            name: item.productNameSnapshot || item.product?.name || 'Producto',
            saleUnit: item.product?.saleUnit || (item.quantityKg ? 'KG' : 'UNIT'),
            quantity: Math.max(1, num(item.quantity || 1)),
            quantityKg: item.quantityKg ?? null,
            price: num(item.price),
            priceType: normalizeEditPriceType((item as any).priceType) || 'MANUAL',
            sku: productSku || null,
            isDelivery,
          };
        })
        .filter((line) => line.productId)
    );
  };

  const editProductsFiltered = useMemo(() => {
    const q = editProductSearch.trim().toLowerCase();

    return products
      .filter((product: any) => {
        if (!q) return true;
        return (
          String(product.name ?? '').toLowerCase().includes(q) ||
          String(product.sku ?? '').toLowerCase().includes(q)
        );
      })
      .slice(0, 24);
  }, [products, editProductSearch]);

  const editSaleStockLocation = useMemo(() => {
    const loc = String((editItemsSale as SaleExtra | null)?.stockLocation ?? 'LOCAL').toUpperCase();
    return loc === 'DEPOSITO' ? 'DEPOSITO' : 'LOCAL';
  }, [editItemsSale]);

  // Quantities of each product in the ORIGINAL sale items (before this edit)
  const oldEditSaleQtyMap = useMemo(() => {
    const map = new Map<string, { qty: number; kg: number }>();
    if (!editItemsSale) return map;
    for (const item of (editItemsSale as SaleExtra).items ?? []) {
      const pid = String(item.productId ?? '');
      if (!pid) continue;
      const existing = map.get(pid) ?? { qty: 0, kg: 0 };
      map.set(pid, {
        qty: existing.qty + num(item.quantity || 0),
        kg: existing.kg + num(item.quantityKg || 0),
      });
    }
    return map;
  }, [editItemsSale]);

  // Effective available stock = current product stock + old sale quantity for that product
  // (because the backend restores the old stock before validating the new quantities)
  const editAvailableStockMap = useMemo(() => {
    const map = new Map<string, { units: number; kg: number }>();
    for (const product of products) {
      const pid = String((product as any).id);
      const old = oldEditSaleQtyMap.get(pid) ?? { qty: 0, kg: 0 };
      const stockUnits = editSaleStockLocation === 'DEPOSITO'
        ? num((product as any).stockDeposito)
        : num((product as any).stockLocal);
      const stockKg = editSaleStockLocation === 'DEPOSITO'
        ? num((product as any).stockDepositoKg)
        : num((product as any).stockLocalKg);
      map.set(pid, {
        units: stockUnits + old.qty,
        kg: stockKg + old.kg,
      });
    }
    return map;
  }, [products, oldEditSaleQtyMap, editSaleStockLocation]);

  const addProductToEditSale = (product: Product) => {
    const productAny = product as any;
    const productId = String(productAny.id);
    const isDelivery = isDeliveryProduct(productAny);
    const defaultPriceType = isDelivery ? 'MANUAL' : getEditSaleDefaultPriceType(editItemsSale);
    const price = getProductEditPrice(product, defaultPriceType);

    setEditLines((prev) => {
      const existing = prev.find((line) => line.productId === productId);

      if (existing && existing.saleUnit !== 'KG') {
        return prev.map((line) =>
          line.productId === productId && !line.isDelivery
            ? { ...line, quantity: line.quantity + 1 }
            : line
        );
      }

      return [
        ...prev,
        {
          key: `${productId}-${Date.now()}`,
          productId,
          name: productEditName(product),
          saleUnit: productAny.saleUnit || 'UNIT',
          quantity: 1,
          quantityKg: productAny.saleUnit === 'KG' ? 0.1 : null,
          price,
          priceType: defaultPriceType,
          sku: productAny.sku ?? null,
          isDelivery,
        },
      ];
    });
  };

  const updateEditLine = (key: string, patch: Partial<SaleEditLine>) => {
    setEditLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const removeEditLine = (key: string) => {
    setEditLines((prev) => prev.filter((line) => line.key !== key));
  };

  const getProductById = (productId: string) =>
    products.find((product: any) => String(product.id) === String(productId));

  const changeEditLinePriceType = (line: SaleEditLine, nextPriceType: string) => {
    const normalized = normalizeEditPriceType(nextPriceType) || 'PRICE';
    const product = getProductById(line.productId);

    updateEditLine(line.key, {
      priceType: normalized,
      price: normalized === 'MANUAL' || !product ? line.price : getProductEditPrice(product, normalized),
    });
  };

  const deliveryProduct = useMemo(
    () => products.find((product: any) => isDeliveryProduct(product)),
    [products]
  );

  const calculatedDeliveryCost = editDeliveryCalculation?.deliveryCost ?? 0;

  const applyDeliveryToEditLines = (calculation: DeliveryCalculation) => {
    if (!deliveryProduct) {
      toast.error(`No encontré el producto de envío con SKU ${DELIVERY_SKU}`);
      return;
    }

    const productAny = deliveryProduct as any;
    const productId = String(productAny.id);

    setEditDeliveryEnabled(true);
    setEditLines((prev) => {
      const existing = prev.find(
        (line) => line.isDelivery || String(line.sku ?? '').toUpperCase() === DELIVERY_SKU
      );

      if (existing) {
        return prev.map((line) =>
          line.key === existing.key
            ? {
                ...line,
                productId,
                name: productEditName(deliveryProduct),
                saleUnit: 'UNIT',
                quantity: 1,
                quantityKg: null,
                price: calculation.deliveryCost,
                priceType: 'MANUAL',
                sku: DELIVERY_SKU,
                isDelivery: true,
              }
            : line
        );
      }

      return [
        ...prev,
        {
          key: `${productId}-delivery-${Date.now()}`,
          productId,
          name: productEditName(deliveryProduct),
          saleUnit: 'UNIT',
          quantity: 1,
          quantityKg: null,
          price: calculation.deliveryCost,
          priceType: 'MANUAL',
          sku: DELIVERY_SKU,
          isDelivery: true,
        },
      ];
    });
  };

  const selectEditDeliveryOption = (option: DeliveryCostOption) => {
    if (!editDeliveryCalculation) return;

    const updated: DeliveryCalculation = {
      ...editDeliveryCalculation,
      distanceKm: option.distanceKm,
      deliveryCost: option.deliveryCost,
      selectedOptionKey: option.key,
    };

    setEditDeliveryDistanceKm(String(updated.distanceKm));
    setEditDeliveryCalculation(updated);
    applyDeliveryToEditLines(updated);
  };

  const calculateEditDelivery = async () => {
    if (!editItemsSale) return;

    const saleExtra = editItemsSale as SaleExtra;
    const selectedClient = saleExtra.client ?? null;
    const selectedBusinessLocation =
      businessLocations.find((location) => location.id === editBusinessLocationId) ?? null;

    if (!selectedClient?.id) {
      toast.error('La venta tiene que tener cliente para calcular el envío');
      return;
    }

    if (!clientHasCoordinates(selectedClient)) {
      toast.error('El cliente seleccionado no tiene coordenadas cargadas');
      return;
    }

    if (!editBusinessLocationId || !selectedBusinessLocation) {
      toast.error('Seleccioná la sucursal o ubicación de salida');
      return;
    }

    if (!locationHasCoordinates(selectedBusinessLocation)) {
      toast.error('La ubicación de salida no tiene coordenadas cargadas');
      return;
    }

    const pricePerKm = num(editDeliveryPricePerKm);
    if (pricePerKm <= 0) {
      toast.error('El precio por km debe ser mayor a 0');
      return;
    }

    if (!deliveryProduct) {
      toast.error(`No encontré el producto de envío con SKU ${DELIVERY_SKU}`);
      return;
    }

    setEditCalculatingDelivery(true);
    const toastId = toast.loading('Calculando envío...');

    try {
      const response = await api.post('/delivery/calculate', {
        businessLocationId: editBusinessLocationId,
        clientId: selectedClient.id,
        pricePerKm,
      });

      const average: DeliveryCostOption | undefined = response.data.average;

      const calculation: DeliveryCalculation = {
        distanceKm: average ? average.distanceKm : num(response.data.distanceKm),
        pricePerKm: num(response.data.pricePerKm),
        deliveryCost: average ? average.deliveryCost : num(response.data.deliveryCost),
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
        options: response.data.options,
        average,
        selectedOptionKey: 'AVERAGE',
      };

      setEditDeliveryDistanceKm(String(calculation.distanceKm));
      setEditDeliveryPricePerKm(String(calculation.pricePerKm));
      setEditDeliveryCalculation(calculation);
      applyDeliveryToEditLines(calculation);

      toast.success(
        calculation.source === 'GOOGLE_ROUTES'
          ? `Envío calculado por ruta real: ${calculation.distanceKm} km · ${fmtMoney(calculation.deliveryCost)}`
          : `Envío estimado: ${calculation.distanceKm} km · ${fmtMoney(calculation.deliveryCost)}`,
        { id: toastId }
      );
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo calcular el envío'), { id: toastId });
    } finally {
      setEditCalculatingDelivery(false);
    }
  };

  const removeDeliveryFromEditSale = () => {
    setEditDeliveryEnabled(false);
    setEditDeliveryCalculation(null);
    setEditDeliveryDistanceKm('');
    setEditLines((prev) =>
      prev.filter((line) => !line.isDelivery && String(line.sku ?? '').toUpperCase() !== DELIVERY_SKU)
    );
  };

  const getEditProductSelectedLabel = (productId: string) => {
    const lines = editLines.filter((line) => line.productId === productId && !line.isDelivery);

    if (!lines.length) return null;

    const product = getProductById(productId) as any;
    const saleUnit = String(product?.saleUnit ?? lines[0]?.saleUnit ?? '').toUpperCase();

    if (saleUnit === 'KG') {
      const totalKg = lines.reduce((acc, line) => acc + num(line.quantityKg), 0);
      return `${totalKg.toLocaleString('es-AR', { maximumFractionDigits: 3 })} kg`;
    }

    const totalQty = lines.reduce((acc, line) => acc + num(line.quantity), 0);
    return `${totalQty} cargado${totalQty === 1 ? '' : 's'}`;
  };

  const editItemsTotal = editLines.reduce((acc, line) => {
    const qty = line.saleUnit === 'KG' ? num(line.quantityKg) : num(line.quantity);
    return acc + qty * num(line.price);
  }, 0);

  const saveSaleItems = async () => {
    if (!editItemsSale) return;

    if (!editLines.length) {
      toast.error('La venta tiene que tener al menos un producto');
      return;
    }

    // Validate stock before calling the API
    for (const line of editLines) {
      if (line.isDelivery) continue;
      const available = editAvailableStockMap.get(line.productId);
      if (available === undefined) continue;
      if (line.saleUnit === 'KG') {
        const kg = num(line.quantityKg);
        if (kg > available.kg) {
          toast.error(`Stock insuficiente para ${line.name}. Disponible: ${available.kg} kg`);
          return;
        }
      } else {
        if (line.quantity > available.units) {
          toast.error(`Stock insuficiente para ${line.name}. Disponible: ${available.units} unid.`);
          return;
        }
      }
    }

    setSavingItems(true);
    const toastId = toast.loading('Actualizando productos de la venta...');

    try {
      const deliveryLine = editLines.find(
        (line) => line.isDelivery || String(line.sku ?? '').toUpperCase() === DELIVERY_SKU
      );
      const deliveryCost = deliveryLine ? num(deliveryLine.price) : 0;

      await api.patch(`/sales/${editItemsSale.id}/items`, {
        businessLocationId: deliveryLine ? editBusinessLocationId || null : editBusinessLocationId || null,
        deliveryMethod: deliveryLine ? 'LOCAL_DELIVERY' : 'PICKUP',
        deliveryStatus: deliveryLine ? 'PENDING' : 'NONE',
        deliveryAddressSnapshot: deliveryLine
          ? editDeliveryCalculation?.deliveryAddressSnapshot ||
            editDeliveryCalculation?.destinationAddress ||
            buildClientAddress((editItemsSale as SaleExtra).client)
          : null,
        deliveryDistanceKm: deliveryLine
          ? num(editDeliveryCalculation?.distanceKm ?? editDeliveryDistanceKm)
          : null,
        deliveryPricePerKm: deliveryLine ? num(editDeliveryPricePerKm, DEFAULT_DELIVERY_PRICE_PER_KM) : null,
        deliveryCost,
        items: editLines.map((line) => ({
          productId: line.productId,
          quantity: line.saleUnit === 'KG' ? undefined : Math.max(1, num(line.quantity)),
          quantityKg: line.saleUnit === 'KG' ? Math.max(0.001, num(line.quantityKg)) : undefined,
          price: num(line.price),
          priceType: normalizeEditPriceType(line.priceType) || 'MANUAL',
        })),
      });

      setEditItemsSale(null);
      setEditLines([]);
      setEditDeliveryEnabled(false);
      setEditDeliveryDistanceKm('');
      setEditDeliveryPricePerKm(String(DEFAULT_DELIVERY_PRICE_PER_KM));
      setEditBusinessLocationId('');
      setEditDeliveryCalculation(null);
      await load();
      toast.success('Productos de la venta actualizados', { id: toastId });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'No se pudieron actualizar los productos'), { id: toastId });
    } finally {
      setSavingItems(false);
    }
  };

  const openInvoiceModal = (sale: Sale) => {
    const saleExtra = sale as SaleExtra;
    const clientDoc = saleExtra.client?.dni || '';

    setInvoiceModal({
      sale,
      tipoComprobante: defaultInvoiceTypeForSale(sale),
      receiverDoc: clientDoc,
      condicionIVAReceptor: 5,
    });
  };

  const submitInvoice = async () => {
    if (!invoiceModal) return;

    const { sale, receiverDoc, condicionIVAReceptor } = invoiceModal;
    const tipoComprobante: InvoiceType = 11;

    const cleanDoc = onlyNumbers(receiverDoc);
    const detectedDoc = detectDocType(receiverDoc);

    const isConsumidorFinal = !cleanDoc || cleanDoc === '0' || condicionIVAReceptor === 5;

    if (sale.status === 'CANCELLED') {
      toast.error('No se puede facturar una venta cancelada');
      return;
    }

    if (isSaleInvoiced(sale)) {
      toast.error('Esta venta ya está facturada');
      return;
    }

    if (!isConsumidorFinal && !detectedDoc) {
      toast.error('El documento del receptor no es válido. Podés dejarlo vacío para Consumidor Final');
      return;
    }

    const payload = {
      saleId: sale.id,
      tipoComprobante,

      tipoDoc: isConsumidorFinal ? 99 : detectedDoc?.tipoDoc ?? 99,

      nroDoc: isConsumidorFinal ? 0 : detectedDoc?.nroDoc ?? 0,

      importe: num(sale.total),

      condicionIVAReceptor: isConsumidorFinal ? 5 : condicionIVAReceptor,

      products: getSaleProductsForAfip(sale),
      metodoPago: getSalePaymentLabel(sale),
    };

    const toastId = toast.loading('Facturando en ARCA...');

    try {
      setInvoicingId(sale.id);

      const response = await api.post('/afip/facturar', payload);

      const data = response.data as AfipInvoiceResponse;
      const factura = data?.factura || data?.content || data?.invoice;

      setInvoiceModal(null);
      await load();

      if (data?.invoiceStatus === 'PENDING_AFIP') {
        toast.error('ARCA no respondió correctamente. La factura quedó pendiente para reintento automático.', {
          id: toastId,
        });
        return;
      }

      if (factura?.cae) {
        toast.success(`Factura generada correctamente. CAE: ${factura.cae}`, { id: toastId });
        return;
      }

      if (data?.cae) {
        toast.success(`Factura generada correctamente. CAE: ${data.cae}`, { id: toastId });
        return;
      }

      toast.success('Factura generada correctamente', { id: toastId });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'No se pudo facturar la venta'), { id: toastId });
    } finally {
      setInvoicingId(null);
    }
  };

  const getFacturaOriginalId = async (sale: Sale) => {
    const saleExtra = sale as SaleExtra;

    const localId =
      saleExtra.invoiceAfip?.id ||
      saleExtra.invoiceAfipId ||
      saleExtra.invoice?.id ||
      saleExtra.factura?.id;

    if (localId) return localId;

    const response = await api.get(`/afip/factura-by-sale/${sale.id}`);

    return response.data?.id as string | undefined;
  };

  const openCreditNoteModal = (sale: Sale) => {
    if (!isSaleInvoiced(sale)) {
      toast.error('La venta tiene que estar facturada para emitir una nota de crédito');
      return;
    }

    if (isCreditNoteSale(sale)) {
      toast.error('No se puede emitir una nota de crédito sobre otra nota de crédito');
      return;
    }

    if (hasCreditNote(sale)) {
      toast.error('Esta factura ya tiene una nota de crédito emitida');
      return;
    }

    if (sale.status === 'CANCELLED') {
      toast.error('No se puede generar nota de crédito sobre una venta cancelada');
      return;
    }

    setCreditNoteModal({
      sale,
      motivo: 'Devolución de productos',
      importe: String(num(sale.total)),
    });
  };

  const submitCreditNote = async () => {
    if (!creditNoteModal) return;

    const { sale, motivo, importe } = creditNoteModal;

    const importeNumber = num(importe);

    if (!motivo.trim()) {
      toast.error('Tenés que indicar un motivo');
      return;
    }

    if (importeNumber <= 0) {
      toast.error('El importe tiene que ser mayor a 0');
      return;
    }

    if (importeNumber > num(sale.total)) {
      setConfirmModal({
        title: 'Confirmar importe',
        message:
          'El importe de la nota de crédito es mayor al total de la venta. ¿Querés continuar igual?',
        confirmText: 'Continuar',
        danger: true,
        onConfirm: submitCreditNoteConfirmed,
      });

      return;
    }

    await submitCreditNoteConfirmed();
  };

  const submitCreditNoteConfirmed = async () => {
    if (!creditNoteModal) return;

    const { sale, motivo, importe } = creditNoteModal;
    const importeNumber = num(importe);

    const toastId = toast.loading('Emitiendo nota de crédito...');

    try {
      setCreditNoteLoadingId(sale.id);

      const facturaOriginalId = await getFacturaOriginalId(sale);

      if (!facturaOriginalId) {
        toast.error('No encontré la factura original de esta venta', { id: toastId });
        return;
      }

      const response = await api.post('/afip/nota-credito', {
        saleId: sale.id,
        facturaOriginalId,
        motivo: motivo.trim(),
        importe: importeNumber,
      });

      setCreditNoteModal(null);
      await load();

      const data = response.data as CreditNoteResponse;
      const notaCredito = data?.notaCredito;

      if (notaCredito?.cae) {
        toast.success(`Nota de crédito emitida correctamente. CAE: ${notaCredito.cae}`, {
          id: toastId,
        });
        return;
      }

      toast.success(data?.message || 'Nota de crédito emitida correctamente', { id: toastId });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'No se pudo emitir la nota de crédito'), { id: toastId });
    } finally {
      setCreditNoteLoadingId(null);
    }
  };

  const openCreditNotePdf = (sale: Sale) => {
    const creditNoteSaleId = getCreditNoteSaleId(sale);

    if (!creditNoteSaleId) {
      toast.error('No encontré la nota de crédito asociada');
      return;
    }

    toast.success('Abriendo nota de crédito');
    window.open(`${API_URL}/nota-credito-pdf/${creditNoteSaleId}/descargar`, '_blank');
  };

  return (
    <AppLayout
      title="Ventas"
      subtitle="Historial, pagos y comprobantes"
      actions={
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            void load(true);
            void loadPendingAfipNotification(true);
          }}
          disabled={loading || checkingPendingAfip}
        >
          Actualizar
        </button>
      }
    >
      {isAdmin && (
        <div
          className="sales-stats-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div className="stat-card">
            <div className="stat-value">{salesCount}</div>
            <div className="stat-label">Ventas</div>
          </div>

          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--accent)' }}>
              {fmtMoney(total)}
            </div>
            <div className="stat-label">Total real</div>
          </div>

          <div className="stat-card">
            <div className="stat-value">{pendingCount}</div>
            <div className="stat-label">Pendientes</div>
          </div>

          <div className="stat-card">
            <div className="stat-value">{completedCount}</div>
            <div className="stat-label">Completadas</div>
          </div>

          <div className="stat-card">
            <div className="stat-value" style={{ color: cancelledCount > 0 ? 'var(--danger)' : 'var(--text)' }}>
              {cancelledCount}
            </div>
            <div className="stat-label">Canceladas</div>
          </div>

          <div className="stat-card">
            <div
              className="stat-value"
              style={{ color: debt > 0 ? 'var(--warn)' : 'var(--accent)' }}
            >
              {fmtMoney(debt)}
            </div>
            <div className="stat-label">Deuda real</div>
          </div>
        </div>
      )}

      {pendingAfipNotification?.hasPendingAfip && (
        <div className="pending-afip-alert">
          <div className="pending-afip-alert-icon">
            <AlertTriangle size={22} />
          </div>

          <div className="pending-afip-alert-main">
            <div className="pending-afip-alert-title-row">
              <div>
                <small>Atención fiscal</small>
                <b>Ventas pendientes de AFIP</b>
              </div>

              <span className="pending-afip-alert-count">
                {pendingAfipNotification.count}
              </span>
            </div>

            <p>
              {pendingAfipNotification.message ||
                `Hay ${pendingAfipNotification.count} venta${pendingAfipNotification.count === 1 ? '' : 's'} pendiente${pendingAfipNotification.count === 1 ? '' : 's'} de facturar.`}
            </p>

            {firstPendingAfipSale?.id && (
              <div className="pending-afip-alert-meta">
                <span>#{firstPendingAfipSale.id.slice(-8)}</span>
                <span>{firstPendingAfipClient || 'Sin cliente'}</span>
                <span>{fmtMoney(num(firstPendingAfipSale.total))}</span>
              </div>
            )}
          </div>

          <div className="pending-afip-alert-actions">
            <button
              className="btn btn-primary btn-sm pending-afip-review-button"
              onClick={() => void openFirstPendingAfipSale(firstPendingAfipSale?.id)}
            >
              <ReceiptText size={14} />
              Revisar venta
            </button>

            <button
              className="btn btn-secondary btn-sm"
              disabled={checkingPendingAfip}
              onClick={() => loadPendingAfipNotification(true)}
            >
              {checkingPendingAfip ? <Loader2 size={14} className="animate-spin" /> : null}
              Actualizar aviso
            </button>
          </div>
        </div>
      )}

      <div className="sales-filters" style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <div className="sales-search" style={{ position: 'relative', flex: 1 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text3)',
            }}
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID o cliente..."
            style={{ paddingLeft: 34 }}
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ width: 180 }}
        >
          <option value="">Todos</option>
          <option value="PENDING">Pendientes</option>
          <option value="COMPLETED">Completadas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>
      </div>

      <div className="card sales-card">
        <div className="table-wrap sales-desktop-table">
          {loading ? (
            <div style={{ padding: 20 }}>
              <div className="skeleton" style={{ height: 240 }} />
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Vendedor</th>
                  <th>Pago</th>
                  <th>Stock</th>
                  <th>Total</th>
                  <th>Deuda</th>
                  <th>Estado</th>
                  <th>AFIP</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {paginatedSales.map((s) => {
                  const invoiceStatus = getSaleInvoiceStatus(s);
                  const quotationExpirationLabel = getQuotationExpirationLabel(s);
                  const saleIsCreditNote = isCreditNoteSale(s);
                  const saleHasCreditNote = hasCreditNote(s);
                  const saleCanEmitCreditNote = canEmitCreditNote(s);
                  const saleCanDownloadCreditNote = canDownloadCreditNote(s);
                  const saleHasRemito = hasRemito(s);
                  const saleCanEmitRemito = canEmitRemito(s);
                  const saleCountsAsMoney = countsAsMoney(s);

                  return (
                    <tr
                      key={s.id}
                      onClick={() => setDetail(s)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontFamily: 'var(--mono)', color: 'var(--text2)' }}>
                        #{s.id.slice(-8)}
                      </td>

                      <td>{fmtDate(s.createdAt)}</td>

                      <td>{clientName(s.client)}</td>

                      <td>{getSaleSellerLabel(s)}</td>

                      <td>
                        <span className="badge badge-gray">
                          {(s as SaleExtra).payments?.length ? 'MIXTO' : s.paymentMethod}
                        </span>
                      </td>

                      <td>
                        <span className={`badge ${getStockLocationBadgeClass(s)}`}>
                          {getStockLocationLabel(s)}
                        </span>
                      </td>

                      <td
                        style={{
                          fontFamily: 'var(--mono)',
                          fontWeight: 900,
                          color: saleCountsAsMoney ? 'var(--accent)' : 'var(--text3)',
                          textDecoration: s.status === 'CANCELLED' ? 'line-through' : undefined,
                        }}
                      >
                        <div>{fmtMoney(s.total)}</div>
                        {!saleCountsAsMoney && (
                          <small style={{ color: 'var(--text3)', fontFamily: 'inherit', fontWeight: 700 }}>
                            No suma
                          </small>
                        )}
                      </td>

                      <td>
                        {num(s.accountDebtAmount) > 0 ? (
                          <span className="badge badge-yellow">
                            {fmtMoney(s.accountDebtAmount ?? 0)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span className={`badge ${badge(s.status)}`}>{s.status}</span>

                          {s.status === 'PENDING' && quotationExpirationLabel && (
                            <small style={{ color: 'var(--text3)' }}>
                              Vence: {quotationExpirationLabel}
                            </small>
                          )}
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <span className={`badge ${invoiceBadge(invoiceStatus)}`}>
                            {invoiceStatus === 'NONE' ? 'SIN FACTURA' : invoiceStatus}
                          </span>

                          {saleIsCreditNote ? (
                            <span className="badge badge-red">NOTA CRÉDITO</span>
                          ) : saleHasCreditNote ? (
                            <span className="badge badge-red">NC EMITIDA</span>
                          ) : null}

                          {saleHasRemito && <span className="badge badge-green">REMITO</span>}
                        </div>
                      </td>

                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-secondary btn-sm sales-row-actions-button"
                          onClick={() => setMobileActionsSale(s)}
                          title="Ver opciones de la venta"
                          aria-label="Ver opciones de la venta"
                        >
                          <MoreHorizontal size={15} />
                          Opciones
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <FileText size={36} />
              <p>Sin ventas</p>
            </div>
          )}
        </div>

        <div className="sales-mobile-list">
          {loading ? (
            <div style={{ padding: 14 }}>
              <div className="skeleton" style={{ height: 240 }} />
            </div>
          ) : (
            paginatedSales.map((s) => {
              const invoiceStatus = getSaleInvoiceStatus(s);
              const quotationExpirationLabel = getQuotationExpirationLabel(s);
              const saleIsCreditNote = isCreditNoteSale(s);
              const saleHasCreditNote = hasCreditNote(s);
              const saleCanEmitCreditNote = canEmitCreditNote(s);
              const saleCanDownloadCreditNote = canDownloadCreditNote(s);
              const saleHasRemito = hasRemito(s);
              const saleCanEmitRemito = canEmitRemito(s);
              const saleCountsAsMoney = countsAsMoney(s);

              return (
                <article
                  key={`${s.id}-mobile`}
                  className="sales-mobile-item"
                  onClick={() => setDetail(s)}
                >
                  <div className="sales-mobile-head">
                    <div>
                      <span className="sales-mobile-id">#{s.id.slice(-8)}</span>
                      <h3>{clientName(s.client)}</h3>
                      <p>{fmtDate(s.createdAt)}</p>
                      <p>Vendedor: {getSaleSellerLabel(s)}</p>
                    </div>

                    <span className={`badge ${badge(s.status)}`}>{s.status}</span>
                  </div>

                  <div className="sales-mobile-badges">
                    <span className="badge badge-gray">
                      {(s as SaleExtra).payments?.length ? 'MIXTO' : s.paymentMethod}
                    </span>

                    <span className={`badge ${getStockLocationBadgeClass(s)}`}>
                      Stock: {getStockLocationLabel(s)}
                    </span>

                    <span className={`badge ${invoiceBadge(invoiceStatus)}`}>
                      {invoiceStatus === 'NONE' ? 'SIN FACTURA' : invoiceStatus}
                    </span>

                    {saleIsCreditNote ? (
                      <span className="badge badge-red">NOTA CRÉDITO</span>
                    ) : saleHasCreditNote ? (
                      <span className="badge badge-red">NC EMITIDA</span>
                    ) : null}

                    {saleHasRemito && <span className="badge badge-green">REMITO</span>}

                    {s.status === 'PENDING' && quotationExpirationLabel && (
                      <span className="badge badge-yellow">Vence {quotationExpirationLabel}</span>
                    )}
                  </div>

                  <div className="sales-mobile-data">
                    <div>
                      <small>{saleCountsAsMoney ? 'Total' : 'Total no sumado'}</small>
                      <strong
                        className={saleCountsAsMoney ? 'sales-accent' : ''}
                        style={{
                          color: saleCountsAsMoney ? undefined : 'var(--text3)',
                          textDecoration: s.status === 'CANCELLED' ? 'line-through' : undefined,
                        }}
                      >
                        {fmtMoney(s.total)}
                      </strong>
                    </div>

                    <div>
                      <small>Deuda</small>
                      <strong>{num(s.accountDebtAmount) > 0 ? fmtMoney(s.accountDebtAmount ?? 0) : '—'}</strong>
                    </div>
                  </div>

                  <div className="sales-mobile-actions" onClick={(e) => e.stopPropagation()}>
                    {s.status === 'PENDING' && (
                      <button
                        className="btn btn-primary btn-sm sales-mobile-main-action"
                        onClick={() => setSaleStatus(s, 'COMPLETED')}
                      >
                        <Check size={14} />
                        Confirmar
                      </button>
                    )}

                    {canEditSaleItems(s) && (
                      <button
                        className="btn btn-secondary btn-sm sales-mobile-main-action"
                        onClick={() => openItemsEditor(s)}
                      >
                        <Plus size={14} />
                        Productos
                      </button>
                    )}

                    {!isSaleInvoiced(s) && s.status !== 'CANCELLED' && (
                      <button
                        className="btn btn-primary btn-sm sales-mobile-main-action"
                        disabled={invoicingId === s.id}
                        onClick={() => openInvoiceModal(s)}
                      >
                        {invoicingId === s.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <ReceiptText size={14} />
                        )}
                        Facturar
                      </button>
                    )}

                    {isSaleInvoiced(s) && (
                      <button
                        className="btn btn-ghost btn-sm sales-mobile-main-action"
                        onClick={() => {
                          toast.success('Abriendo factura');
                          window.open(`${API_URL}/factura-pdf/${s.id}/descargar`, '_blank');
                        }}
                      >
                        <FileText size={14} />
                        Factura
                      </button>
                    )}

                    <button
                      className="btn btn-secondary btn-sm sales-mobile-more-action"
                      onClick={() => setMobileActionsSale(s)}
                    >
                      <MoreHorizontal size={15} />
                      Más acciones
                    </button>
                  </div>
                </article>
              );
            })
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <FileText size={36} />
              <p>Sin ventas</p>
            </div>
          )}
        </div>

        {!loading && totalFilteredItems > 0 && (
          <div className="sales-pagination">
            <div className="sales-pagination-info">
              Mostrando {pageStart} - {pageEnd} de {totalFilteredItems} ventas
            </div>

            <div className="sales-pagination-actions">
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </button>

              <span className="sales-pagination-page">
                Página {currentPage} de {totalPages}
              </span>

              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>


      {mounted &&
        mobileActionsSale &&
        createPortal(
          (() => {
          const s = mobileActionsSale;
          const invoiceStatus = getSaleInvoiceStatus(s);
          const quotationExpirationLabel = getQuotationExpirationLabel(s);
          const saleIsCreditNote = isCreditNoteSale(s);
          const saleHasCreditNote = hasCreditNote(s);
          const saleCanEmitCreditNote = canEmitCreditNote(s);
          const saleCanDownloadCreditNote = canDownloadCreditNote(s);
          const saleHasRemito = hasRemito(s);
          const saleCanEmitRemito = canEmitRemito(s);

          return (
            <div
              className="modal-overlay sales-mobile-actions-overlay"
              onClick={(e) => e.target === e.currentTarget && setMobileActionsSale(null)}
            >
              <div className="modal sales-actions-sheet" role="dialog" aria-modal="true">
                <div className="sales-actions-grabber" />

                <div className="modal-header sales-actions-header">
                  <div>
                    <small>Acciones de venta</small>
                    <b>#{s.id.slice(-8)} · {clientName(s.client)}</b>
                    <small>Vendedor: {getSaleSellerLabel(s)}</small>
                  </div>

                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setMobileActionsSale(null)}
                    aria-label="Cerrar acciones"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="modal-body sales-actions-body">
                  <div className="sales-actions-summary">
                    <div>
                      <small>Total</small>
                      <b>{fmtMoney(s.total)}</b>
                    </div>

                    <div>
                      <small>Estado</small>
                      <span className={`badge ${badge(s.status)}`}>{s.status}</span>
                    </div>

                    <div>
                      <small>Stock</small>
                      <span className={`badge ${getStockLocationBadgeClass(s)}`}>
                        {getStockLocationLabel(s)}
                      </span>
                    </div>

                    <div>
                      <small>Vendedor</small>
                      <b>{getSaleSellerLabel(s)}</b>
                    </div>

                    <div>
                      <small>AFIP</small>
                      <span className={`badge ${invoiceBadge(invoiceStatus)}`}>
                        {invoiceStatus === 'NONE' ? 'SIN FACTURA' : invoiceStatus}
                      </span>
                    </div>
                  </div>

                  <div className="sales-actions-badges">
                    <span className="badge badge-gray">
                      {(s as SaleExtra).payments?.length ? 'MIXTO' : s.paymentMethod}
                    </span>

                    <span className={`badge ${getStockLocationBadgeClass(s)}`}>
                      Stock: {getStockLocationLabel(s)}
                    </span>

                    {saleIsCreditNote ? (
                      <span className="badge badge-red">NOTA CRÉDITO</span>
                    ) : saleHasCreditNote ? (
                      <span className="badge badge-red">NC EMITIDA</span>
                    ) : null}

                    {saleHasRemito && <span className="badge badge-green">REMITO</span>}

                    {s.status === 'PENDING' && quotationExpirationLabel && (
                      <span className="badge badge-yellow">Vence {quotationExpirationLabel}</span>
                    )}
                  </div>

                  <div className="sales-actions-list">
                    <button
                      className="sales-action-row"
                      onClick={() => {
                        setDetail(s);
                        setMobileActionsSale(null);
                      }}
                    >
                      <span>
                        <FileText size={17} />
                      </span>
                      <div>
                        <b>Ver detalle</b>
                        <small>Productos, pagos y remitos</small>
                      </div>
                    </button>

                    {canEditSaleItems(s) && (
                      <button
                        className="sales-action-row"
                        onClick={() => {
                          openItemsEditor(s);
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          <Plus size={17} />
                        </span>
                        <div>
                          <b>Editar productos</b>
                          <small>Agregar o modificar productos antes de confirmar</small>
                        </div>
                      </button>
                    )}

                    {s.status === 'PENDING' && (
                      <button
                        className="sales-action-row sales-action-row-primary"
                        onClick={() => {
                          setSaleStatus(s, 'COMPLETED');
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          <Check size={17} />
                        </span>
                        <div>
                          <b>Confirmar venta</b>
                          <small>Pasar la venta a completada</small>
                        </div>
                      </button>
                    )}

                    {s.status !== 'CANCELLED' && (
                      <button
                        className="sales-action-row sales-action-row-danger"
                        onClick={() => {
                          setSaleStatus(s, 'CANCELLED');
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          <X size={17} />
                        </span>
                        <div>
                          <b>Cancelar venta</b>
                          <small>Revertir stock/deuda si corresponde</small>
                        </div>
                      </button>
                    )}

                    <button
                      className="sales-action-row"
                      onClick={() => {
                        openPayments(s);
                        setMobileActionsSale(null);
                      }}
                    >
                      <span>
                        <ReceiptText size={17} />
                      </span>
                      <div>
                        <b>Editar pagos</b>
                        <small>Efectivo, transferencia, tarjeta o mixto</small>
                      </div>
                    </button>

                    <button
                      className="sales-action-row"
                      disabled={printingTicketId === s.id}
                      onClick={() => {
                        printTicket(s);
                        setMobileActionsSale(null);
                      }}
                    >
                      <span>
                        {printingTicketId === s.id ? (
                          <Loader2 size={17} className="animate-spin" />
                        ) : (
                          <Printer size={17} />
                        )}
                      </span>
                      <div>
                        <b>Imprimir ticket</b>
                        <small>Enviar ticket no fiscal a impresión</small>
                      </div>
                    </button>

                    {saleCanEmitRemito && !saleHasRemito && s.status !== 'CANCELLED' && (
                      <button
                        className="sales-action-row"
                        disabled={remitoLoadingId === s.id}
                        onClick={() => {
                          createRemito(s);
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          {remitoLoadingId === s.id ? (
                            <Loader2 size={17} className="animate-spin" />
                          ) : (
                            <Truck size={17} />
                          )}
                        </span>
                        <div>
                          <b>Generar remito</b>
                          <small>Crear remito desde esta venta</small>
                        </div>
                      </button>
                    )}

                    {(saleHasRemito || saleCanEmitRemito) && (
                      <button
                        className="sales-action-row"
                        disabled={openingRemitoId === s.id}
                        onClick={() => {
                          openRemitoPdf(s);
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          {openingRemitoId === s.id ? (
                            <Loader2 size={17} className="animate-spin" />
                          ) : (
                            <FileText size={17} />
                          )}
                        </span>
                        <div>
                          <b>Ver remito</b>
                          <small>Descargar PDF del remito si existe</small>
                        </div>
                      </button>
                    )}

                    {s.status === 'PENDING' && (
                      <button
                        className="sales-action-row"
                        disabled={quotationLoadingId === s.id}
                        onClick={() => {
                          setQuotationModal(s);
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          {quotationLoadingId === s.id ? (
                            <Loader2 size={17} className="animate-spin" />
                          ) : (
                            <MessageCircle size={17} />
                          )}
                        </span>
                        <div>
                          <b>Cotización</b>
                          <small>Descargar o enviar PDF por WhatsApp</small>
                        </div>
                      </button>
                    )}

                    {s.status === 'COMPLETED' && !isSaleInvoiced(s) && (
                      <button
                        className="sales-action-row"
                        disabled={comprobanteLoadingId === s.id}
                        onClick={() => {
                          setComprobanteModal(s);
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          {comprobanteLoadingId === s.id ? (
                            <Loader2 size={17} className="animate-spin" />
                          ) : (
                            <FileText size={17} />
                          )}
                        </span>
                        <div>
                          <b>Comprobante de venta</b>
                          <small>Descargar o enviar PDF por WhatsApp (sin facturar)</small>
                        </div>
                      </button>
                    )}

                    {!isSaleInvoiced(s) && s.status !== 'CANCELLED' && (
                      <button
                        className="sales-action-row sales-action-row-primary"
                        disabled={invoicingId === s.id}
                        onClick={() => {
                          openInvoiceModal(s);
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          {invoicingId === s.id ? (
                            <Loader2 size={17} className="animate-spin" />
                          ) : (
                            <ReceiptText size={17} />
                          )}
                        </span>
                        <div>
                          <b>Facturar en ARCA</b>
                          <small>Generar CAE y comprobante fiscal</small>
                        </div>
                      </button>
                    )}

                    {isSaleInvoiced(s) && (
                      <button
                        className="sales-action-row"
                        onClick={() => {
                          toast.success('Abriendo factura');
                          window.open(`${API_URL}/factura-pdf/${s.id}/descargar`, '_blank');
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          <FileText size={17} />
                        </span>
                        <div>
                          <b>Ver factura</b>
                          <small>Descargar PDF de factura</small>
                        </div>
                      </button>
                    )}

                    {isSaleInvoiced(s) && saleCanDownloadCreditNote && (
                      <button
                        className="sales-action-row"
                        onClick={() => {
                          openCreditNotePdf(s);
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          <FileText size={17} />
                        </span>
                        <div>
                          <b>Ver nota de crédito</b>
                          <small>Descargar PDF de NC</small>
                        </div>
                      </button>
                    )}

                    {isSaleInvoiced(s) && saleCanEmitCreditNote && (
                      <button
                        className="sales-action-row sales-action-row-danger"
                        disabled={creditNoteLoadingId === s.id}
                        onClick={() => {
                          openCreditNoteModal(s);
                          setMobileActionsSale(null);
                        }}
                      >
                        <span>
                          {creditNoteLoadingId === s.id ? (
                            <Loader2 size={17} className="animate-spin" />
                          ) : (
                            <ReceiptText size={17} />
                          )}
                        </span>
                        <div>
                          <b>Emitir nota de crédito</b>
                          <small>Generar NC vinculada en ARCA</small>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
          })(),
          document.body
        )}

      {mounted && detail && createPortal(
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setDetail(null)}
        >
          <div className="modal sales-detail-modal" style={{ maxWidth: 760 }}>
            <div className="modal-header">
              <b>Venta #{detail.id.slice(-8)}</b>

              <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div
                className="sales-detail-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                <div>
                  <small>Cliente</small>
                  <b style={{ display: 'block' }}>{clientName(detail.client)}</b>
                </div>

                <div>
                  <small>Vendedor</small>
                  <b style={{ display: 'block' }}>{getSaleSellerLabel(detail)}</b>
                </div>

                <div>
                  <small>{countsAsMoney(detail) ? 'Total' : 'Total no sumado'}</small>
                  <b
                    style={{
                      display: 'block',
                      color: countsAsMoney(detail) ? 'var(--accent)' : 'var(--text3)',
                      textDecoration: detail.status === 'CANCELLED' ? 'line-through' : undefined,
                    }}
                  >
                    {fmtMoney(detail.total)}
                  </b>
                </div>

                <div>
                  <small>Estado</small>
                  <b style={{ display: 'block' }}>{detail.status}</b>
                </div>

                <div>
                  <small>Stock descontado de</small>
                  <b style={{ display: 'block' }}>
                    <span className={`badge ${getStockLocationBadgeClass(detail)}`}>
                      {getStockLocationLabel(detail)}
                    </span>
                  </b>
                </div>
              </div>

              {(detail as SaleExtra).quotationExpiresAt && detail.status === 'PENDING' && (
                <div
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: 12,
                    marginBottom: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <small>Cotización válida hasta</small>
                    <b style={{ display: 'block' }}>
                      {fmtDate((detail as SaleExtra).quotationExpiresAt)}
                    </b>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={quotationLoadingId === detail.id}
                    onClick={() => setQuotationModal(detail)}
                  >
                    {quotationLoadingId === detail.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <FileText size={13} />
                    )}
                    Cotización
                  </button>
                </div>
              )}

              {canEditSaleItems(detail) && (
                <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openItemsEditor(detail)}>
                    <Plus size={13} />
                    Editar productos
                  </button>
                </div>
              )}

              <div className="card sales-detail-products-card">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Precio</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(detail as SaleExtra).items?.map((i, index) => (
                      <tr key={i.id ?? `${i.productNameSnapshot ?? 'producto'}-${index}`}>
                        <td>{i.productNameSnapshot ?? i.product?.name ?? 'Producto'}</td>
                        <td>{i.quantityKg ? `${i.quantityKg} kg` : i.quantity}</td>
                        <td>{fmtMoney(i.price)}</td>
                        <td>{fmtMoney(i.subtotal ?? i.price * (i.quantityKg ?? i.quantity ?? 1))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(detail as SaleExtra).payments?.length ? (
                <div style={{ marginTop: 16 }}>
                  <b>Pagos</b>

                  {(detail as SaleExtra).payments?.map((p, i) => (
                    <div
                      key={`${p.method}-${i}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <span>{p.method}</span>
                      <b>{fmtMoney(p.amount)}</b>
                    </div>
                  ))}
                </div>
              ) : null}

              <div style={{ marginTop: 16 }}>
                <b>Remitos</b>

                <div
                  style={{
                    marginTop: 10,
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: 12,
                    display: 'flex',
                    gap: 10,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    {hasRemito(detail) ? (
                      <>
                        <small style={{ color: 'var(--text3)' }}>Remito emitido</small>
                        <b style={{ display: 'block' }}>
                          {getSaleRemitos(detail)[0]?.fullNumber || 'Remito generado'}
                        </b>
                      </>
                    ) : (
                      <>
                        <small style={{ color: 'var(--text3)' }}>Estado</small>
                        <b style={{ display: 'block' }}>
                          {canEmitRemito(detail)
                            ? 'Disponible para emitir'
                            : 'La venta debe estar completada o facturada'}
                        </b>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {canEmitRemito(detail) && !hasRemito(detail) && detail.status !== 'CANCELLED' && (
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={remitoLoadingId === detail.id}
                        onClick={() => createRemito(detail)}
                      >
                        {remitoLoadingId === detail.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Truck size={13} />
                        )}
                        Generar remito
                      </button>
                    )}

                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={openingRemitoId === detail.id}
                      onClick={() => openRemitoPdf(detail)}
                    >
                      {openingRemitoId === detail.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <FileText size={13} />
                      )}
                      Ver remito
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        ,
        document.body
      )}

      {mounted && quotationModal && createPortal(
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setQuotationModal(null)}
        >
          <div className="modal sales-small-modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <b>Cotización #{quotationModal.id.slice(-8)}</b>

              <button className="btn btn-ghost btn-sm" onClick={() => setQuotationModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text2)', marginBottom: 14 }}>
                Elegí qué querés hacer con la cotización PDF de{' '}
                <b>{clientName(quotationModal.client)}</b>.
              </p>

              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 12,
                  display: 'grid',
                  gap: 6,
                }}
              >
                <small style={{ color: 'var(--text3)' }}>Total cotizado</small>
                <b style={{ fontSize: 20, color: 'var(--accent)' }}>
                  {fmtMoney(quotationModal.total)}
                </b>
              </div>

              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: 12,
                  color: 'var(--text2)',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Para enviar el <b>PDF por WhatsApp</b>, el sistema usa el menú de compartir del
                dispositivo. En celular te debería aparecer WhatsApp como opción. En PC, si el
                navegador no permite compartir archivos, se descarga el PDF para adjuntarlo manualmente.
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                disabled={quotationLoadingId === quotationModal.id}
                onClick={() => downloadQuotation(quotationModal)}
              >
                {quotationLoadingId === quotationModal.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileText size={16} />
                )}
                Descargar PDF
              </button>

              <button
                className="btn btn-primary"
                disabled={quotationLoadingId === quotationModal.id}
                onClick={() => shareQuotationPdfWhatsapp(quotationModal)}
              >
                {quotationLoadingId === quotationModal.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <MessageCircle size={16} />
                )}
                Enviar PDF por WhatsApp
              </button>
            </div>
          </div>
        </div>
        ,
        document.body
      )}

      {mounted && comprobanteModal && createPortal(
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setComprobanteModal(null)}
        >
          <div className="modal sales-small-modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <b>Comprobante #{comprobanteModal.id.slice(-8)}</b>

              <button className="btn btn-ghost btn-sm" onClick={() => setComprobanteModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text2)', marginBottom: 14 }}>
                Elegí qué querés hacer con el comprobante PDF de{' '}
                <b>{clientName(comprobanteModal.client)}</b>.
              </p>

              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 12,
                  display: 'grid',
                  gap: 6,
                }}
              >
                <small style={{ color: 'var(--text3)' }}>Total de la venta</small>
                <b style={{ fontSize: 20, color: 'var(--accent)' }}>
                  {fmtMoney(comprobanteModal.total)}
                </b>
              </div>

              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: 12,
                  color: 'var(--text2)',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Este comprobante no es válido como factura. Para enviarlo por{' '}
                <b>WhatsApp</b>, el sistema usa el menú de compartir del dispositivo. En celular
                te debería aparecer WhatsApp como opción. En PC, si el navegador no permite
                compartir archivos, se descarga el PDF para adjuntarlo manualmente.
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                disabled={comprobanteLoadingId === comprobanteModal.id}
                onClick={() => downloadComprobante(comprobanteModal)}
              >
                {comprobanteLoadingId === comprobanteModal.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileText size={16} />
                )}
                Descargar PDF
              </button>

              <button
                className="btn btn-primary"
                disabled={comprobanteLoadingId === comprobanteModal.id}
                onClick={() => shareComprobantePdfWhatsapp(comprobanteModal)}
              >
                {comprobanteLoadingId === comprobanteModal.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <MessageCircle size={16} />
                )}
                Enviar PDF por WhatsApp
              </button>
            </div>
          </div>
        </div>
        ,
        document.body
      )}

      {mounted && invoiceModal && createPortal(
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setInvoiceModal(null)}
        >
          <div className="modal sales-small-modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <b>Facturar venta #{invoiceModal.sale.id.slice(-8)}</b>

              <button className="btn btn-ghost btn-sm" onClick={() => setInvoiceModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text2)', marginBottom: 14 }}>
                Total a facturar: <b>{fmtMoney(invoiceModal.sale.total)}</b>
              </p>

              <div className="form-group">
                <label className="form-label">Tipo de comprobante</label>

                <div
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '10px 12px',
                    background: 'var(--surface2)',
                    fontWeight: 900,
                    color: 'var(--accent)',
                  }}
                >
                  Factura C
                </div>

                <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 4 }}>
                  El sistema está configurado para emitir únicamente Factura C.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Documento receptor (opcional)</label>

                <input
                  value={invoiceModal.receiverDoc}
                  onChange={(e) =>
                    setInvoiceModal((prev) =>
                      prev ? { ...prev, receiverDoc: e.target.value } : prev
                    )
                  }
                  placeholder="Vacío = Consumidor Final / o cargá DNI, CUIL o CUIT"
                />

                <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 4 }}>
                  Factura C puede salir como Consumidor Final sin documento. Si cargás documento,
                  debe ser DNI, CUIL o CUIT válido.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Condición IVA receptor</label>

                <select
                  value={invoiceModal.condicionIVAReceptor}
                  onChange={(e) =>
                    setInvoiceModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            condicionIVAReceptor: Number(e.target.value),
                          }
                        : prev
                    )
                  }
                >
                  <option value={5}>Consumidor Final</option>
                  <option value={1}>IVA Responsable Inscripto</option>
                  <option value={6}>Responsable Monotributo</option>
                  <option value={4}>IVA Sujeto Exento</option>
                </select>
              </div>

              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: 12,
                  color: 'var(--text2)',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Este botón llama a <b>POST /afip/facturar</b>, genera CAE en ARCA,
                guarda la factura AFIP y actualiza la venta como facturada.
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setInvoiceModal(null)}>
                Cancelar
              </button>

              <button
                className="btn btn-primary"
                disabled={invoicingId === invoiceModal.sale.id}
                onClick={submitInvoice}
              >
                {invoicingId === invoiceModal.sale.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Facturar en ARCA
              </button>
            </div>
          </div>
        </div>
        ,
        document.body
      )}

      {mounted && creditNoteModal && createPortal(
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setCreditNoteModal(null)}
        >
          <div className="modal sales-small-modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <b>Emitir nota de crédito</b>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setCreditNoteModal(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text2)', marginBottom: 14 }}>
                Venta #{creditNoteModal.sale.id.slice(-8)} — Total original:{' '}
                <b>{fmtMoney(creditNoteModal.sale.total)}</b>
              </p>

              <div className="form-group">
                <label className="form-label">Motivo</label>

                <textarea
                  value={creditNoteModal.motivo}
                  onChange={(e) =>
                    setCreditNoteModal((prev) =>
                      prev ? { ...prev, motivo: e.target.value } : prev
                    )
                  }
                  placeholder="Ej: Devolución de productos"
                  style={{
                    minHeight: 90,
                    resize: 'vertical',
                  }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Importe a acreditar</label>

                <input
                  type="number"
                  value={creditNoteModal.importe}
                  onChange={(e) =>
                    setCreditNoteModal((prev) =>
                      prev ? { ...prev, importe: e.target.value } : prev
                    )
                  }
                  placeholder="Importe"
                />
              </div>

              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: 12,
                  color: 'var(--text2)',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Este botón llama a <b>POST /afip/nota-credito</b>. ARCA genera una nota
                de crédito vinculada a la factura original de esta venta.
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCreditNoteModal(null)}>
                Cancelar
              </button>

              <button
                className="btn btn-danger"
                disabled={creditNoteLoadingId === creditNoteModal.sale.id}
                onClick={submitCreditNote}
              >
                {creditNoteLoadingId === creditNoteModal.sale.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Emitir nota de crédito
              </button>
            </div>
          </div>
        </div>
        ,
        document.body
      )}

      {mounted && editItemsSale && createPortal(
        <div className="modal-overlay">
          <div className="modal sales-edit-items-modal">
            <div className="modal-header">
              <div>
                <b>Editar productos · #{editItemsSale.id.slice(-8)}</b>
                <small style={{ display: 'block', color: 'var(--text3)', marginTop: 3 }}>
                  Solo disponible antes de confirmar o facturar la venta.
                </small>
              </div>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setEditItemsSale(null)}
                disabled={savingItems}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body sales-edit-items-body">
              <div className="sales-edit-products-picker">
                <div className="sales-edit-lines-head" style={{ position: 'static', margin: 0, padding: 0, borderBottom: 'none' }}>
                  <b>Agregar productos</b>
                  <span>{editProductsFiltered.length}</span>
                </div>

                <div className="sales-search" style={{ position: 'relative' }}>
                  <Search
                    size={14}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text3)',
                    }}
                  />
                  <input
                    value={editProductSearch}
                    onChange={(e) => setEditProductSearch(e.target.value)}
                    placeholder="Buscar producto para agregar..."
                    style={{ paddingLeft: 34, width: '100%' }}
                  />
                </div>

                <div className="sales-edit-products-list">
                  {loadingProducts ? (
                    <div className="sales-edit-empty">Cargando productos...</div>
                  ) : editProductsFiltered.length ? (
                    editProductsFiltered.map((product: any) => {
                      const selectedLabel = getEditProductSelectedLabel(String(product.id));

                      return (
                        <button
                          key={product.id}
                          type="button"
                          className={`sales-edit-product-row ${selectedLabel ? 'is-selected' : ''}`}
                          onClick={() => addProductToEditSale(product)}
                        >
                          <span>
                            <Package size={16} />
                          </span>
                          <div>
                            <b>{product.name}</b>
                            <small>{product.sku || 'SIN-SKU'} · {fmtMoney(getProductEditPrice(product, getEditSaleDefaultPriceType(editItemsSale)))} · {getEditPriceLabel(getEditSaleDefaultPriceType(editItemsSale))}</small>
                          </div>
                          {selectedLabel ? (
                            <strong className="sales-edit-product-count">{selectedLabel}</strong>
                          ) : (
                            <Plus size={15} />
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="sales-edit-empty">No encontré productos</div>
                  )}
                </div>
              </div>

              <div className="sales-edit-delivery-card">
                <div className="sales-edit-lines-head" style={{ position: 'static', margin: 0, padding: 0, borderBottom: 'none' }}>
                  <b>Envío</b>
                  <span>{editDeliveryCalculation ? fmtMoney(editDeliveryCalculation.deliveryCost) : 'Opcional'}</span>
                </div>

                <div className="sales-edit-delivery-grid">
                  <label>
                    <span>Sale desde</span>
                    <select
                      value={editBusinessLocationId}
                      onChange={(e) => {
                        setEditBusinessLocationId(e.target.value);
                        setEditDeliveryCalculation(null);
                        removeDeliveryFromEditSale();
                      }}
                    >
                      <option value="">
                        {businessLocations.length ? 'Seleccionar ubicación' : 'Sin ubicaciones cargadas'}
                      </option>
                      {businessLocations.map((location: any) => (
                        <option key={location.id} value={location.id}>
                          {location.name}{location.isDefault ? ' · default' : ''}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Precio por km</span>
                    <input
                      type="number"
                      min={0}
                      value={editDeliveryPricePerKm}
                      onChange={(e) => {
                        setEditDeliveryPricePerKm(e.target.value);
                        setEditDeliveryCalculation(null);
                        removeDeliveryFromEditSale();
                      }}
                      placeholder="Ej: 8000"
                    />
                  </label>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm sales-edit-delivery-calc"
                    onClick={calculateEditDelivery}
                    disabled={editCalculatingDelivery || !editBusinessLocationId || !(editItemsSale as SaleExtra).client?.id}
                  >
                    <Truck size={14} />
                    {editCalculatingDelivery ? 'Calculando...' : 'Calcular envío'}
                  </button>
                </div>

                {editDeliveryCalculation && (
                  <div className={editDeliveryCalculation.source === 'COORDINATES_FALLBACK' ? 'sales-edit-delivery-ok fallback' : 'sales-edit-delivery-ok'}>
                    <div className="sales-edit-delivery-ok-head">
                      <b>Envío: {fmtMoney(editDeliveryCalculation.deliveryCost)}</b>
                      <span className={editDeliveryCalculation.source === 'GOOGLE_ROUTES' ? 'sales-route-source google' : 'sales-route-source fallback'}>
                        {deliverySourceLabel(editDeliveryCalculation.source)}
                      </span>
                    </div>
                    <span>Ruta: {editDeliveryCalculation.distanceKm} km x {fmtMoney(editDeliveryCalculation.pricePerKm)}</span>
                    {formatDurationMinutes(editDeliveryCalculation.durationMinutes) && (
                      <span>Tiempo estimado: {formatDurationMinutes(editDeliveryCalculation.durationMinutes)}</span>
                    )}
                    {editDeliveryCalculation.source === 'COORDINATES_FALLBACK' && (
                      <small>Google no respondió. Se usó distancia recta ajustada como cálculo aproximado.</small>
                    )}
                    {editDeliveryCalculation.options && editDeliveryCalculation.average && (
                      <div className="sales-edit-delivery-options">
                        <small>Elegí una opción de costo de envío:</small>
                        <div className="sales-edit-delivery-options-list">
                          {[...editDeliveryCalculation.options, editDeliveryCalculation.average].map((option) => (
                            <button
                              type="button"
                              key={option.key}
                              className={`sales-edit-delivery-option${editDeliveryCalculation.selectedOptionKey === option.key ? ' selected' : ''}`}
                              onClick={() => selectEditDeliveryOption(option)}
                            >
                              <span>{option.label}</span>
                              <b>{fmtMoney(option.deliveryCost)}</b>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="sales-edit-delivery-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={removeDeliveryFromEditSale}
                    disabled={!editLines.some((line) => line.isDelivery || String(line.sku ?? '').toUpperCase() === DELIVERY_SKU)}
                  >
                    Quitar envío
                  </button>
                </div>

                {(editItemsSale as SaleExtra).client && !clientHasCoordinates((editItemsSale as SaleExtra).client) && (
                  <small style={{ color: 'var(--warn)', lineHeight: 1.4 }}>
                    El cliente no tiene coordenadas cargadas. No se puede calcular ruta automática.
                  </small>
                )}

                {!deliveryProduct && (
                  <small style={{ color: 'var(--warn)', lineHeight: 1.4 }}>
                    Para usar envío, tiene que existir el producto con SKU {DELIVERY_SKU}.
                  </small>
                )}
              </div>

              <div className="sales-edit-lines">
                <div className="sales-edit-lines-head">
                  <b>Productos de la venta</b>
                  <span>{editLines.length} items</span>
                </div>

                {editLines.map((line) => (
                  <div className="sales-edit-line" key={line.key}>
                    <div className="sales-edit-line-title">
                      <div>
                        <b>{line.name}</b>
                        <small className="sales-edit-line-meta">
                          {line.sku ? `${line.sku} · ` : ''}{line.isDelivery ? 'Envío' : getEditPriceLabel(line.priceType)}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => removeEditLine(line.key)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div className="sales-edit-line-controls">
                      {line.saleUnit === 'KG' ? (
                        <label>
                          <span>Kg</span>
                          <input
                            type="number"
                            step="0.001"
                            value={line.quantityKg ?? ''}
                            onChange={(e) => updateEditLine(line.key, { quantityKg: num(e.target.value) })}
                          />
                          {(() => {
                            const available = editAvailableStockMap.get(line.productId);
                            const over = available !== undefined && num(line.quantityKg) > available.kg;
                            return over ? (
                              <small style={{ color: 'var(--danger, #dc2626)' }}>
                                ⚠ Disponible: {available.kg} kg
                              </small>
                            ) : null;
                          })()}
                        </label>
                      ) : (
                        <label>
                          <span>Cantidad</span>
                          <input
                            type="number"
                            min={1}
                            max={editAvailableStockMap.get(line.productId)?.units ?? undefined}
                            value={line.quantity}
                            onChange={(e) => updateEditLine(line.key, { quantity: Math.max(1, num(e.target.value)) })}
                          />
                          {(() => {
                            const available = editAvailableStockMap.get(line.productId);
                            const over = available !== undefined && line.quantity > available.units;
                            return over ? (
                              <small style={{ color: 'var(--danger, #dc2626)' }}>
                                ⚠ Disponible: {available.units}
                              </small>
                            ) : null;
                          })()}
                        </label>
                      )}

                      <label>
                        <span>Tipo precio</span>
                        <select
                          value={normalizeEditPriceType(line.priceType) || 'MANUAL'}
                          disabled={line.isDelivery}
                          onChange={(e) => changeEditLinePriceType(line, e.target.value)}
                        >
                          <option value="PRICE">Minorista</option>
                          <option value="WHOLESALE_PRICE">Mayorista</option>
                          <option value="MANUAL">Manual / mantener actual</option>
                        </select>
                      </label>

                      <label>
                        <span>Precio</span>
                        <input
                          type="number"
                          value={line.price}
                          onChange={(e) => updateEditLine(line.key, { price: num(e.target.value), priceType: 'MANUAL' })}
                        />
                      </label>

                      <div>
                        <span>Subtotal</span>
                        <b>
                          {fmtMoney(
                            num(line.price) *
                              (line.saleUnit === 'KG' ? num(line.quantityKg) : num(line.quantity))
                          )}
                        </b>
                      </div>
                    </div>
                  </div>
                ))}

                {!editLines.length && (
                  <div className="sales-edit-empty">Agregá productos para actualizar la venta.</div>
                )}
              </div>
            </div>

            <div className="modal-footer sales-edit-items-footer">
              <div>
                <small>Total recalculado</small>
                <b>{fmtMoney(editItemsTotal)}</b>
              </div>

              <button
                className="btn btn-secondary"
                onClick={() => setEditItemsSale(null)}
                disabled={savingItems}
              >
                Cancelar
              </button>

              <button
                className="btn btn-primary"
                onClick={saveSaleItems}
                disabled={savingItems || !editLines.length}
              >
                {savingItems ? <span className="spinner" /> : <Check size={16} />}
                Guardar productos
              </button>
            </div>
          </div>
        </div>
        ,
        document.body
      )}

      {mounted && payEdit && createPortal(
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setPayEdit(null)}
        >
          <div className="modal sales-small-modal">
            <div className="modal-header">
              <b>Editar pagos</b>

              <button className="btn btn-ghost btn-sm" onClick={() => setPayEdit(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text2)', marginBottom: 12 }}>
                Total venta: {fmtMoney(payEdit.total)}. Si la suma es menor, la diferencia
                queda en cuenta corriente.
              </p>

              {payments.map((p, idx) => (
                <div
                  key={`${p.method}-${idx}`}
                  className="sales-payment-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px 36px',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <select
                    value={p.method}
                    onChange={(e) =>
                      setPayments((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? {
                                ...x,
                                method: e.target.value as PaymentMethod,
                              }
                            : x
                        )
                      )
                    }
                  >
                    {methods.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    value={p.amount || ''}
                    disabled={p.method === 'CUENTA_CORRIENTE'}
                    onChange={(e) =>
                      setPayments((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? {
                                ...x,
                                amount: num(e.target.value),
                              }
                            : x
                        )
                      )
                    }
                  />

                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setPayments((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setPayments((prev) => [...prev, { method: 'TRANSFERENCIA', amount: 0 }])
                }
              >
                Agregar pago
              </button>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPayEdit(null)}>
                Cancelar
              </button>

              <button className="btn btn-primary" onClick={savePayments}>
                <Check size={16} />
                Guardar
              </button>
            </div>
          </div>
        </div>
        ,
        document.body
      )}

      {mounted && confirmModal && createPortal(
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (confirmLoading) return;
            if (e.target === e.currentTarget) setConfirmModal(null);
          }}
        >
          <div className="modal sales-small-modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <b>{confirmModal.title}</b>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => !confirmLoading && setConfirmModal(null)}
                disabled={confirmLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: confirmModal.danger
                      ? 'rgba(239,68,68,0.12)'
                      : 'var(--surface2)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle
                    size={18}
                    style={{
                      color: confirmModal.danger ? 'var(--danger)' : 'var(--accent)',
                    }}
                  />
                </span>

                <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.55, margin: 0, whiteSpace: 'pre-line' }}>
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmModal(null)}
                disabled={confirmLoading}
              >
                Cancelar
              </button>

              <button
                className={confirmModal.danger ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={confirmAction}
                disabled={confirmLoading}
              >
                {confirmLoading ? <span className="spinner" /> : confirmModal.confirmText ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
        ,
        document.body
      )}

      <style jsx>{`
        .modal-overlay {
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483000 !important;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          overflow-y: auto;
        }

        .modal {
          margin: auto;
          max-height: calc(100dvh - 36px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-body {
          overflow-y: auto;
        }

        :global(html),
        :global(body) {
          overflow-x: hidden;
        }

        .sales-stats-grid {
          width: 100% !important;
          max-width: 100% !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          box-sizing: border-box;
        }

        .sales-stats-grid .stat-card {
          min-width: 0 !important;
          width: auto !important;
          max-width: 100% !important;
          box-sizing: border-box;
          padding: 16px 18px !important;
        }

        .sales-stats-grid .stat-value {
          font-size: clamp(20px, 2.3vw, 30px) !important;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sales-card,
        .sales-filters,
        .pending-afip-alert {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .sales-desktop-table {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
        }

        .sales-desktop-table table {
          width: 100%;
          min-width: 0;
          table-layout: fixed;
          border-collapse: collapse;
        }

        .sales-desktop-table th,
        .sales-desktop-table td {
          padding: 10px 8px;
          font-size: 12px;
          vertical-align: middle;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sales-desktop-table th {
          font-size: 10px;
          letter-spacing: 0.12em;
          white-space: nowrap;
        }

        .sales-desktop-table th:nth-child(1),
        .sales-desktop-table td:nth-child(1) {
          width: 8%;
        }

        .sales-desktop-table th:nth-child(2),
        .sales-desktop-table td:nth-child(2) {
          width: 9%;
        }

        .sales-desktop-table th:nth-child(3),
        .sales-desktop-table td:nth-child(3) {
          width: 13%;
        }

        .sales-desktop-table th:nth-child(4),
        .sales-desktop-table td:nth-child(4) {
          width: 7%;
        }

        .sales-desktop-table th:nth-child(5),
        .sales-desktop-table td:nth-child(5) {
          width: 10%;
        }

        .sales-desktop-table th:nth-child(6),
        .sales-desktop-table td:nth-child(6) {
          width: 9%;
        }

        .sales-desktop-table th:nth-child(7),
        .sales-desktop-table td:nth-child(7) {
          width: 9%;
        }

        .sales-desktop-table th:nth-child(8),
        .sales-desktop-table td:nth-child(8) {
          width: 6%;
        }

        .sales-desktop-table th:nth-child(9),
        .sales-desktop-table td:nth-child(9) {
          width: 11%;
        }

        .sales-desktop-table th:nth-child(10),
        .sales-desktop-table td:nth-child(10) {
          width: 9%;
        }

        .sales-desktop-table th:nth-child(11),
        .sales-desktop-table td:nth-child(11) {
          width: 9%;
        }

        .sales-desktop-table td:nth-child(3) {
          white-space: normal;
          line-height: 1.35;
          overflow: hidden;
        }

        .sales-desktop-table td:nth-child(4),
        .sales-desktop-table td:nth-child(5),
        .sales-desktop-table td:nth-child(6),
        .sales-desktop-table td:nth-child(7),
        .sales-desktop-table td:nth-child(8),
        .sales-desktop-table td:nth-child(10) {
          white-space: nowrap;
        }

        .sales-desktop-table td:nth-child(9) small {
          display: block;
          white-space: normal;
          line-height: 1.25;
        }

        .sales-desktop-table .badge {
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sales-row-actions-button {
          width: 100%;
          min-width: 0 !important;
          justify-content: center;
          gap: 5px;
          padding-inline: 8px !important;
          font-size: 12px;
        }

        @media (max-width: 1280px) {
          .sales-desktop-table th,
          .sales-desktop-table td {
            padding-left: 6px;
            padding-right: 6px;
            font-size: 11.5px;
          }

          .sales-desktop-table th {
            font-size: 9px;
            letter-spacing: 0.1em;
          }

          .sales-desktop-table th:nth-child(1),
          .sales-desktop-table td:nth-child(1) {
            width: 8%;
          }

          .sales-desktop-table th:nth-child(2),
          .sales-desktop-table td:nth-child(2) {
            width: 9%;
          }

          .sales-desktop-table th:nth-child(3),
          .sales-desktop-table td:nth-child(3) {
            width: 14%;
          }

          .sales-desktop-table th:nth-child(4),
          .sales-desktop-table td:nth-child(4) {
            width: 7%;
          }

          .sales-desktop-table th:nth-child(5),
          .sales-desktop-table td:nth-child(5) {
            width: 10%;
          }

          .sales-desktop-table th:nth-child(6),
          .sales-desktop-table td:nth-child(6) {
            width: 9%;
          }

          .sales-desktop-table th:nth-child(7),
          .sales-desktop-table td:nth-child(7) {
            width: 9%;
          }

          .sales-desktop-table th:nth-child(8),
          .sales-desktop-table td:nth-child(8) {
            width: 5%;
          }

          .sales-desktop-table th:nth-child(9),
          .sales-desktop-table td:nth-child(9) {
            width: 11%;
          }

          .sales-desktop-table th:nth-child(10),
          .sales-desktop-table td:nth-child(10) {
            width: 9%;
          }

          .sales-desktop-table th:nth-child(11),
          .sales-desktop-table td:nth-child(11) {
            width: 9%;
          }

          .sales-row-actions-button {
            font-size: 11px;
            padding-inline: 6px !important;
          }
        }

        @media (min-width: 1600px) {
          .sales-stats-grid {
            grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 1280px) {
          .sales-stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 10px !important;
          }

          .sales-stats-grid .stat-card {
            padding: 14px 16px !important;
          }

          .sales-stats-grid .stat-value {
            font-size: 24px !important;
          }
        }

        @media (max-width: 980px) {
          .sales-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        .pending-afip-alert {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(245, 158, 11, 0.28);
          background:
            linear-gradient(135deg, rgba(245, 158, 11, 0.14), rgba(245, 158, 11, 0.04) 42%, var(--surface) 100%);
          border-radius: 22px;
          padding: 16px;
          margin-bottom: 18px;
          display: grid;
          grid-template-columns: 52px minmax(0, 1fr);
          gap: 14px;
          align-items: center;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.08);
        }

        .pending-afip-alert::before {
          content: '';
          position: absolute;
          inset: 0 auto 0 0;
          width: 5px;
          background: var(--warn);
        }

        .pending-afip-alert-icon {
          width: 52px;
          height: 52px;
          border-radius: 17px;
          background: rgba(245, 158, 11, 0.16);
          color: var(--warn);
          display: grid;
          place-items: center;
          box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.22);
        }

        .pending-afip-alert-main {
          min-width: 0;
          display: grid;
          gap: 8px;
        }

        .pending-afip-alert-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .pending-afip-alert-title-row > div {
          display: grid;
          gap: 2px;
          min-width: 0;
        }

        .pending-afip-alert-title-row small {
          color: var(--warn);
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .pending-afip-alert-title-row b {
          color: var(--text);
          font-size: 17px;
          line-height: 1.15;
        }

        .pending-afip-alert-count {
          min-width: 32px;
          height: 32px;
          border-radius: 999px;
          background: var(--warn);
          color: white;
          display: grid;
          place-items: center;
          font-family: var(--mono);
          font-size: 14px;
          font-weight: 950;
          box-shadow: 0 10px 22px rgba(245, 158, 11, 0.22);
        }

        .pending-afip-alert-main p {
          margin: 0;
          color: var(--text2);
          font-size: 13px;
          line-height: 1.45;
          max-width: 760px;
        }

        .pending-afip-alert-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .pending-afip-alert-meta span {
          border: 1px solid rgba(245, 158, 11, 0.22);
          background: rgba(255, 255, 255, 0.48);
          color: var(--text2);
          border-radius: 999px;
          padding: 6px 9px;
          font-size: 11px;
          font-weight: 850;
          line-height: 1;
        }

        .pending-afip-alert-meta span:first-child {
          color: var(--text);
          font-family: var(--mono);
          font-weight: 950;
        }

        .pending-afip-alert-actions {
          grid-column: 2;
          display: flex;
          gap: 8px;
          min-width: 0;
          justify-items: stretch;
          flex-wrap: wrap;
          justify-content: flex-start;
        }

        .pending-afip-alert-actions button {
          width: auto;
          min-width: 138px;
          justify-content: center;
          white-space: nowrap;
        }

        .pending-afip-review-button {
          box-shadow: 0 12px 24px rgba(16, 185, 129, 0.18);
        }

        .sales-pagination {
          border-top: 1px solid var(--border);
          padding: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          background: var(--surface);
        }

        .sales-pagination-info {
          color: var(--text3);
          font-size: 12px;
          font-weight: 700;
        }

        .sales-pagination-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sales-pagination-page {
          color: var(--text2);
          font-size: 12px;
          font-weight: 800;
          padding: 0 4px;
        }

        .sales-mobile-list {
          display: none;
        }

        .sales-accent {
          color: var(--accent);
        }

        .sales-row-actions-button {
          min-width: 112px;
          justify-content: center;
          gap: 6px;
        }

        .sales-edit-items-modal {
          width: min(1280px, calc(100vw - 36px)) !important;
          max-width: min(1280px, calc(100vw - 36px)) !important;
          height: min(94dvh, 900px);
          max-height: calc(100dvh - 24px);
          overflow: hidden;
        }

        .sales-edit-items-modal .modal-header {
          flex-shrink: 0;
          padding: 18px 24px;
          border-bottom: 1px solid var(--border);
        }

        .sales-edit-items-body {
          flex: 1 1 auto;
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(340px, 430px) minmax(560px, 1fr);
          grid-template-rows: auto minmax(0, 1fr);
          gap: 16px;
          padding: 16px !important;
          overflow: hidden !important;
          background: var(--bg);
        }

        .sales-edit-products-picker,
        .sales-edit-lines,
        .sales-edit-delivery-card {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
          border: 1px solid var(--border);
          border-radius: 18px;
          background: var(--surface);
          padding: 12px;
        }

        .sales-edit-products-picker {
          grid-row: 1 / span 2;
          min-height: 0;
          max-height: none;
          overflow: hidden;
        }

        .sales-edit-delivery-card {
          min-height: 0;
        }

        .sales-edit-lines {
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding-right: 10px;
        }

        .sales-edit-products-list {
          flex: 1 1 auto;
          min-height: 0;
          max-height: none;
          display: grid;
          align-content: start;
          gap: 8px;
          overflow-y: auto;
          overflow-x: hidden;
          padding-right: 4px;
        }

        .sales-edit-product-row {
          width: 100%;
          min-width: 0;
          border: 1px solid var(--border);
          border-radius: 15px;
          background: var(--surface2);
          color: var(--text);
          padding: 9px 10px;
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr) auto;
          gap: 9px;
          align-items: center;
          text-align: left;
          cursor: pointer;
          transition:
            transform 0.12s ease,
            border-color 0.12s ease,
            background 0.12s ease;
        }

        .sales-edit-product-row:hover {
          border-color: color-mix(in srgb, var(--accent) 36%, var(--border));
          background: color-mix(in srgb, var(--accent) 7%, var(--surface2));
        }

        .sales-edit-product-row:active {
          transform: scale(0.99);
        }

        .sales-edit-product-row.is-selected {
          border-color: color-mix(in srgb, var(--accent) 32%, var(--border));
          background: color-mix(in srgb, var(--accent) 7%, var(--surface2));
        }

        .sales-edit-product-count {
          border-radius: 999px;
          background: color-mix(in srgb, var(--accent) 13%, var(--surface));
          border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
          color: var(--accent);
          font-family: var(--mono);
          font-size: 11px;
          font-weight: 900;
          line-height: 1;
          padding: 7px 9px;
          white-space: nowrap;
          justify-self: end;
        }

        .sales-edit-product-row > span {
          width: 32px;
          height: 32px;
          border-radius: 12px;
          background: var(--bg);
          display: grid;
          place-items: center;
          color: var(--accent);
          flex-shrink: 0;
        }

        .sales-edit-product-row > div {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .sales-edit-product-row b,
        .sales-edit-product-row small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sales-edit-product-row b,
        .sales-edit-line-title b {
          font-size: 13px;
          line-height: 1.25;
        }

        .sales-edit-product-row small {
          color: var(--text3);
          font-size: 11px;
        }

        .sales-edit-lines-head {
          position: sticky;
          top: 0;
          z-index: 2;
          margin: -12px -12px 0;
          padding: 12px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
        }

        .sales-edit-lines-head span {
          color: var(--text3);
          font-size: 12px;
          font-weight: 900;
        }

        .sales-edit-line {
          border: 1px solid var(--border);
          border-radius: 18px;
          background: var(--surface2);
          padding: 13px;
          display: grid;
          gap: 12px;
        }

        .sales-edit-line-title {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: flex-start;
          min-width: 0;
        }

        .sales-edit-line-title > div {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .sales-edit-line-title b {
          min-width: 0;
          overflow-wrap: anywhere;
          white-space: normal;
        }

        .sales-edit-line-meta {
          color: var(--text3);
          font-size: 11px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .sales-edit-line-controls,
        .sales-edit-delivery-grid {
          display: grid;
          grid-template-columns: minmax(90px, 0.75fr) minmax(125px, 1fr) minmax(130px, 1fr) minmax(140px, 0.8fr);
          gap: 10px;
          align-items: stretch;
        }

        .sales-edit-line-controls label,
        .sales-edit-line-controls > div,
        .sales-edit-delivery-grid label,
        .sales-edit-delivery-grid > div {
          min-width: 0;
          display: grid;
          gap: 6px;
        }

        .sales-edit-line-controls > div,
        .sales-edit-delivery-grid > div {
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--bg);
          padding: 9px 10px;
          align-content: center;
        }

        .sales-edit-line-controls span,
        .sales-edit-delivery-grid span,
        .sales-edit-items-footer small {
          color: var(--text3);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .sales-edit-line-controls input,
        .sales-edit-line-controls select,
        .sales-edit-delivery-grid input,
        .sales-edit-delivery-grid select {
          width: 100%;
          min-width: 0;
          height: 42px;
        }

        .sales-edit-delivery-grid {
          grid-template-columns: minmax(210px, 1.4fr) minmax(140px, 0.8fr) auto;
          align-items: end;
        }

        .sales-edit-delivery-calc {
          min-height: 42px;
          white-space: nowrap;
        }

        .sales-edit-delivery-ok {
          display: grid;
          gap: 5px;
          border: 1px solid rgba(34, 197, 94, 0.25);
          background: rgba(34, 197, 94, 0.08);
          color: var(--text2);
          border-radius: 14px;
          padding: 10px;
          font-size: 12px;
        }

        .sales-edit-delivery-ok.fallback {
          border-color: rgba(245, 158, 11, 0.32);
          background: rgba(245, 158, 11, 0.09);
        }

        .sales-edit-delivery-ok b {
          color: var(--accent);
        }

        .sales-edit-delivery-ok small {
          color: var(--text3);
          font-size: 11px;
          line-height: 1.35;
        }

        .sales-edit-delivery-ok-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .sales-route-source {
          flex-shrink: 0;
          border-radius: 999px;
          padding: 4px 7px;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .sales-route-source.google {
          background: rgba(34, 197, 94, 0.13);
          color: var(--accent);
          border: 1px solid rgba(34, 197, 94, 0.25);
        }

        .sales-route-source.fallback {
          background: rgba(245, 158, 11, 0.13);
          color: var(--warn);
          border: 1px solid rgba(245, 158, 11, 0.25);
        }

        .sales-edit-delivery-options {
          display: grid;
          gap: 6px;
          margin-top: 4px;
        }

        .sales-edit-delivery-options-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .sales-edit-delivery-option {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          border-radius: 10px;
          padding: 6px 10px;
          font-size: 11px;
          color: var(--text2);
          cursor: pointer;
        }

        .sales-edit-delivery-option b {
          font-size: 12px;
          color: var(--text1);
        }

        .sales-edit-delivery-option.selected {
          border-color: var(--accent);
          background: rgba(34, 197, 94, 0.14);
        }

        .sales-edit-delivery-option.selected b {
          color: var(--accent);
        }

        .sales-edit-delivery-card {
          overflow: visible;
        }

        .sales-edit-delivery-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sales-edit-line-controls b,
        .sales-edit-delivery-grid b,
        .sales-edit-items-footer b {
          color: var(--accent);
          font-family: var(--mono);
          font-size: 14px;
          overflow-wrap: anywhere;
        }

        .sales-edit-empty {
          border: 1px dashed var(--border);
          border-radius: 16px;
          padding: 18px;
          color: var(--text3);
          text-align: center;
          font-size: 12px;
          background: var(--surface2);
        }

        .sales-edit-items-footer {
          flex-shrink: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          gap: 12px;
          align-items: center;
          padding: 14px 24px !important;
          border-top: 1px solid var(--border);
          background: var(--surface);
          box-shadow: 0 -10px 30px rgba(15, 23, 42, 0.06);
        }

        .sales-edit-items-footer > div {
          display: grid;
          gap: 3px;
        }

        @media (max-width: 1180px) {
          .pending-afip-alert {
            grid-template-columns: 44px minmax(0, 1fr);
            padding: 13px 14px;
          }

          .pending-afip-alert-icon {
            width: 44px;
            height: 44px;
            border-radius: 15px;
          }

          .pending-afip-alert-actions {
            grid-column: 1 / -1;
            width: 100%;
          }

          .pending-afip-alert-actions button {
            flex: 1 1 180px;
            min-width: 0;
          }

          .pending-afip-alert-title-row b {
            font-size: 15px;
          }

          .pending-afip-alert-main p {
            max-width: none;
          }
        }

        @media (max-width: 1100px) {
          .sales-edit-items-body {
            display: flex;
            flex-direction: column;
            overflow-y: auto !important;
          }

          .sales-edit-products-picker {
            grid-row: auto;
            max-height: 330px;
          }

          .sales-edit-products-list {
            max-height: 230px;
          }

          .sales-edit-lines {
            overflow: visible;
            padding-right: 0;
          }
        }

        @media (max-width: 1024px) {
          .sales-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 768px) {
          .modal-overlay {
            align-items: flex-start;
            padding: 12px;
          }

          .modal {
            margin-top: 0;
            max-height: calc(100dvh - 24px);
          }

          .pending-afip-alert {
            grid-template-columns: 42px minmax(0, 1fr);
            align-items: flex-start;
            padding: 12px;
            margin-bottom: 14px;
            border-radius: 17px;
            gap: 10px;
          }

          .pending-afip-alert-icon {
            width: 42px;
            height: 42px;
            border-radius: 14px;
          }

          .pending-afip-alert-title-row {
            gap: 8px;
          }

          .pending-afip-alert-title-row b {
            font-size: 14px;
          }

          .pending-afip-alert-count {
            width: 28px;
            min-width: 28px;
            height: 28px;
            font-size: 12px;
          }

          .pending-afip-alert-main p {
            font-size: 12px;
          }

          .pending-afip-alert-meta {
            gap: 6px;
          }

          .pending-afip-alert-meta span {
            padding: 5px 7px;
            font-size: 10px;
          }

          .pending-afip-alert-actions {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: 1fr 1fr;
            min-width: 0;
            width: 100%;
          }

          .pending-afip-alert-actions button {
            width: 100%;
            justify-content: center;
          }

          .sales-pagination {
            display: grid;
            grid-template-columns: 1fr;
            justify-items: stretch;
            padding: 12px;
          }

          .sales-pagination-info {
            text-align: center;
          }

          .sales-pagination-actions {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .sales-pagination-actions button {
            width: 100%;
            justify-content: center;
          }

          .sales-pagination-page {
            text-align: center;
          }

          .sales-stats-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
            margin-bottom: 14px !important;
          }

          .sales-filters {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 10px !important;
            margin-bottom: 14px !important;
          }

          .sales-search {
            width: 100%;
          }

          .sales-search input,
          .sales-filters select {
            width: 100% !important;
          }

          .sales-card {
            border-radius: 18px;
            overflow: hidden;
          }

          .sales-desktop-table {
            display: none;
          }

          .sales-mobile-list {
            display: grid;
            gap: 10px;
            padding: 12px;
          }

          .sales-mobile-item {
            border: 1px solid var(--border);
            border-radius: 16px;
            background: var(--surface2);
            padding: 12px;
            display: grid;
            gap: 12px;
            min-width: 0;
            cursor: pointer;
          }

          .sales-mobile-head {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 10px;
            min-width: 0;
          }

          .sales-mobile-head > div {
            min-width: 0;
            display: grid;
            gap: 4px;
          }

          .sales-mobile-id {
            font-family: var(--mono);
            color: var(--text3);
            font-size: 11px;
            font-weight: 800;
          }

          .sales-mobile-head h3 {
            font-size: 14px;
            line-height: 1.25;
            font-weight: 900;
            color: var(--text);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .sales-mobile-head p {
            margin: 0;
            color: var(--text3);
            font-size: 12px;
          }

          .sales-mobile-head > .badge {
            flex-shrink: 0;
          }

          .sales-mobile-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 7px;
          }

          .sales-mobile-data {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .sales-mobile-data > div {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            border-radius: 12px;
            background: var(--bg);
            padding: 9px 10px;
            min-width: 0;
          }

          .sales-mobile-data small {
            color: var(--text3);
            font-size: 11px;
            font-weight: 800;
          }

          .sales-mobile-data strong {
            font-family: var(--mono);
            font-size: 12px;
            text-align: right;
            overflow-wrap: anywhere;
          }

          .sales-mobile-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .sales-mobile-actions button {
            width: 100%;
            justify-content: center;
            min-height: 34px;
          }

          .sales-detail-modal,
          .sales-small-modal,
          .sales-edit-items-modal {
            width: calc(100vw - 24px) !important;
            max-width: calc(100vw - 24px) !important;
            max-height: calc(100dvh - 24px);
            overflow: auto;
            border-radius: 18px;
          }

          .sales-edit-items-body {
            display: flex;
            flex-direction: column;
            overflow-y: auto !important;
          }

          .sales-edit-products-picker {
            grid-row: auto;
            max-height: 290px;
          }

          .sales-edit-products-list {
            max-height: 210px;
          }

          .sales-edit-line-controls,
          .sales-edit-delivery-grid {
            grid-template-columns: 1fr;
          }

          .sales-edit-delivery-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .sales-edit-delivery-actions button {
            width: 100%;
            justify-content: center;
          }

          .sales-edit-items-footer {
            grid-template-columns: 1fr;
          }

          .sales-detail-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .sales-detail-products-card {
            overflow-x: auto;
          }

          .sales-detail-products-card table {
            min-width: 520px;
          }

          .modal-header {
            gap: 12px;
          }

          .modal-header b {
            font-size: 14px;
            line-height: 1.3;
          }

          .modal-body {
            padding: 14px !important;
          }

          .modal-footer {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .modal-footer button {
            width: 100%;
            justify-content: center;
          }

          .form-row {
            grid-template-columns: 1fr !important;
          }

          .sales-payment-row {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 10px;
            background: var(--surface2);
          }

          .sales-payment-row button {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 420px) {
          .sales-mobile-list {
            padding: 10px;
          }

          .sales-mobile-item {
            border-radius: 14px;
            padding: 10px;
          }

          .sales-mobile-head {
            flex-direction: column;
            align-items: stretch;
          }

          .sales-mobile-head h3 {
            white-space: normal;
          }

          .sales-mobile-head > .badge {
            width: fit-content;
          }

          .sales-mobile-data > div {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .sales-mobile-data strong {
            text-align: left;
          }

          .sales-mobile-actions {
            grid-template-columns: 1fr;
          }

          .sales-detail-modal,
          .sales-small-modal {
            width: calc(100vw - 18px) !important;
            max-width: calc(100vw - 18px) !important;
            border-radius: 16px;
          }
        }

        .sales-actions-sheet {
          width: min(520px, calc(100vw - 24px));
          border-radius: 22px;
        }

        .sales-actions-grabber {
          display: none;
        }

        .sales-actions-header {
          align-items: flex-start;
        }

        .sales-actions-header > div {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .sales-actions-header small {
          color: var(--text3);
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .sales-actions-header b {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sales-actions-body {
          display: grid;
          gap: 12px;
        }

        .sales-actions-summary {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
        }

        .sales-actions-summary > div {
          border: 1px solid var(--border);
          background: var(--surface2);
          border-radius: 14px;
          padding: 10px;
          min-width: 0;
          display: grid;
          gap: 5px;
        }

        .sales-actions-summary small {
          color: var(--text3);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .sales-actions-summary b {
          font-family: var(--mono);
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .sales-actions-badges {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
        }

        .sales-actions-list {
          display: grid;
          gap: 8px;
        }

        .sales-action-row {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--surface2);
          color: var(--text);
          padding: 11px;
          display: grid;
          grid-template-columns: 38px 1fr;
          gap: 10px;
          text-align: left;
          align-items: center;
          cursor: pointer;
          transition:
            transform 0.12s ease,
            border-color 0.12s ease,
            background 0.12s ease;
        }

        .sales-action-row:not(:disabled):active {
          transform: scale(0.99);
        }

        .sales-action-row:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .sales-action-row > span {
          width: 38px;
          height: 38px;
          border-radius: 13px;
          background: var(--bg);
          display: grid;
          place-items: center;
          color: var(--text2);
        }

        .sales-action-row div {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .sales-action-row b {
          font-size: 13px;
          line-height: 1.2;
        }

        .sales-action-row small {
          color: var(--text3);
          font-size: 11px;
          line-height: 1.25;
        }

        .sales-action-row-primary {
          border-color: rgba(16, 185, 129, 0.28);
        }

        .sales-action-row-primary > span {
          color: var(--accent);
        }

        .sales-action-row-danger {
          border-color: rgba(239, 68, 68, 0.25);
        }

        .sales-action-row-danger > span {
          color: var(--danger);
        }

        @media (max-width: 768px) {
          .sales-mobile-actions {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
          }

          .sales-mobile-actions button {
            width: 100%;
            justify-content: center;
            min-height: 38px;
            border-radius: 13px;
          }

          .sales-mobile-main-action {
            min-width: 0;
          }

          .sales-mobile-more-action {
            grid-column: 1 / -1;
          }

          .sales-mobile-actions-overlay {
            align-items: flex-end;
            padding: 0;
          }

          .sales-actions-sheet {
            width: 100% !important;
            max-width: 100% !important;
            max-height: min(82dvh, 720px);
            margin: 0;
            border-radius: 24px 24px 0 0;
            animation: salesSheetUp 0.16s ease-out;
          }

          .sales-actions-grabber {
            display: block;
            width: 42px;
            height: 4px;
            border-radius: 999px;
            background: var(--border);
            margin: 10px auto 0;
            flex-shrink: 0;
          }

          .sales-actions-header {
            position: sticky;
            top: 0;
            z-index: 2;
            background: var(--surface);
          }

          .sales-actions-body {
            padding-bottom: calc(16px + env(safe-area-inset-bottom)) !important;
          }
        }

        @media (max-width: 420px) {
          .sales-mobile-actions {
            grid-template-columns: 1fr !important;
          }

          .sales-actions-summary {
            grid-template-columns: 1fr;
          }

          .sales-action-row {
            grid-template-columns: 36px 1fr;
            border-radius: 14px;
          }

          .sales-action-row > span {
            width: 36px;
            height: 36px;
          }
        }


        @media (max-width: 768px) {
          .sales-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
            margin-bottom: 10px !important;
          }

          .sales-stats-grid .stat-card {
            padding: 10px !important;
            min-height: 64px;
          }

          .sales-stats-grid .stat-value {
            font-size: 18px !important;
            line-height: 1.05 !important;
          }

          .sales-stats-grid .stat-label {
            font-size: 10px !important;
            line-height: 1.15 !important;
          }

          .sales-filters {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) 118px !important;
            gap: 8px !important;
            margin-bottom: 10px !important;
          }

          .sales-filters select,
          .sales-search input {
            min-height: 38px !important;
            height: 38px !important;
            font-size: 12px !important;
          }

          .sales-mobile-list {
            gap: 7px !important;
            padding: 8px !important;
          }

          .sales-mobile-item {
            padding: 9px !important;
            gap: 7px !important;
            border-radius: 13px !important;
          }

          .sales-mobile-head {
            flex-direction: row !important;
            align-items: flex-start !important;
            gap: 8px !important;
          }

          .sales-mobile-id {
            font-size: 10px !important;
          }

          .sales-mobile-head h3 {
            font-size: 13px !important;
            line-height: 1.15 !important;
            white-space: nowrap !important;
          }

          .sales-mobile-head p {
            font-size: 10.5px !important;
            line-height: 1.15 !important;
          }

          .sales-mobile-badges {
            gap: 5px !important;
            max-height: 23px;
            overflow: hidden;
          }

          .sales-mobile-badges .badge {
            font-size: 9.5px !important;
            padding: 4px 6px !important;
            line-height: 1 !important;
          }

          .sales-mobile-badges .badge:nth-child(n + 4) {
            display: none !important;
          }

          .sales-mobile-data {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 6px !important;
          }

          .sales-mobile-data > div {
            padding: 7px 8px !important;
            border-radius: 10px !important;
            align-items: flex-start !important;
          }

          .sales-mobile-data small {
            font-size: 9.5px !important;
          }

          .sales-mobile-data strong {
            font-size: 11px !important;
            line-height: 1.15 !important;
          }

          .sales-mobile-actions {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 6px !important;
          }

          .sales-mobile-actions button {
            min-height: 32px !important;
            border-radius: 11px !important;
            font-size: 11px !important;
            padding: 7px 6px !important;
            gap: 4px !important;
          }

          .sales-mobile-more-action {
            grid-column: auto !important;
          }

          .sales-mobile-actions-overlay {
            position: fixed !important;
            inset: 0 !important;
            z-index: 2147483000 !important;
            align-items: flex-end !important;
            justify-content: center !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: rgba(0, 0, 0, 0.48) !important;
          }

          .sales-actions-sheet {
            width: 100% !important;
            max-width: 100% !important;
            max-height: min(86dvh, 760px) !important;
            margin: 0 !important;
            border-radius: 24px 24px 0 0 !important;
            box-shadow: 0 -18px 60px rgba(0, 0, 0, 0.28);
          }

          .sales-actions-body {
            overflow-y: auto !important;
            padding-bottom: calc(18px + env(safe-area-inset-bottom)) !important;
          }
        }

        @media (max-width: 420px) {
          .sales-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .sales-filters {
            grid-template-columns: minmax(0, 1fr) 108px !important;
          }

          .sales-mobile-head {
            flex-direction: row !important;
            align-items: flex-start !important;
          }

          .sales-mobile-head > .badge {
            width: auto !important;
            flex-shrink: 0;
          }

          .sales-mobile-data > div {
            flex-direction: column !important;
            gap: 3px !important;
          }

          .sales-mobile-actions {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }

          .sales-mobile-actions button {
            font-size: 10.5px !important;
          }
        }

        @keyframes salesSheetUp {
          from {
            transform: translateY(18px);
            opacity: 0.85;
          }

          to {
            transform: translateY(0);
            opacity: 1;
          }
        }


        /* ===== EDITAR PRODUCTOS: MOBILE PRO ===== */
        @media (max-width: 768px) {
          .sales-edit-items-modal {
            width: calc(100vw - 12px) !important;
            max-width: calc(100vw - 12px) !important;
            height: calc(100dvh - 12px) !important;
            max-height: calc(100dvh - 12px) !important;
            margin: 6px auto !important;
            border-radius: 18px !important;
            overflow: hidden !important;
          }

          .sales-edit-items-modal .modal-header {
            padding: 10px 12px !important;
            min-height: 58px;
            position: relative;
            z-index: 4;
            background: var(--surface);
          }

          .sales-edit-items-modal .modal-header > div {
            min-width: 0;
          }

          .sales-edit-items-modal .modal-header b {
            display: block;
            max-width: calc(100vw - 90px);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 14px !important;
          }

          .sales-edit-items-modal .modal-header small {
            font-size: 10.5px;
            line-height: 1.2;
          }

          .sales-edit-items-body {
            flex: 1 1 auto !important;
            min-height: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 10px !important;
            padding: 10px !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            background: var(--bg) !important;
          }

          .sales-edit-products-picker,
          .sales-edit-delivery-card,
          .sales-edit-lines {
            border-radius: 16px !important;
            padding: 10px !important;
            gap: 9px !important;
          }

          .sales-edit-products-picker {
            flex: 0 0 auto !important;
            max-height: 42dvh !important;
            overflow: hidden !important;
          }

          .sales-edit-products-list {
            max-height: calc(42dvh - 98px) !important;
            gap: 7px !important;
            padding-right: 2px !important;
          }

          .sales-edit-lines-head {
            margin: -10px -10px 0 !important;
            padding: 10px !important;
            min-height: 42px;
          }

          .sales-edit-lines-head b {
            font-size: 13px;
          }

          .sales-edit-lines-head span {
            font-size: 11px !important;
          }

          .sales-edit-product-row {
            min-height: 52px;
            padding: 8px !important;
            border-radius: 14px !important;
            grid-template-columns: 30px minmax(0, 1fr) auto !important;
            gap: 8px !important;
          }

          .sales-edit-product-row > span {
            width: 30px !important;
            height: 30px !important;
            border-radius: 11px !important;
          }

          .sales-edit-product-row b {
            font-size: 12px !important;
            line-height: 1.15 !important;
          }

          .sales-edit-product-row small {
            font-size: 10px !important;
            line-height: 1.15 !important;
          }

          .sales-edit-product-count {
            max-width: 82px;
            padding: 6px 7px !important;
            font-size: 10px !important;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .sales-edit-delivery-grid {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }

          .sales-edit-delivery-grid label,
          .sales-edit-delivery-grid > div {
            gap: 5px !important;
          }

          .sales-edit-delivery-grid input,
          .sales-edit-delivery-grid select {
            height: 40px !important;
            font-size: 12px !important;
          }

          .sales-edit-delivery-calc,
          .sales-edit-delivery-actions button {
            width: 100% !important;
            min-height: 40px !important;
            justify-content: center !important;
            font-size: 12px !important;
          }

          .sales-edit-delivery-ok {
            padding: 9px !important;
            border-radius: 13px !important;
            font-size: 11px !important;
          }

          .sales-edit-delivery-ok-head {
            align-items: flex-start !important;
          }

          .sales-route-source {
            font-size: 9px !important;
            padding: 4px 6px !important;
          }

          .sales-edit-lines {
            flex: 0 0 auto !important;
            overflow: visible !important;
            padding-right: 10px !important;
          }

          .sales-edit-line {
            padding: 10px !important;
            border-radius: 15px !important;
            gap: 10px !important;
          }

          .sales-edit-line-title {
            gap: 8px !important;
          }

          .sales-edit-line-title b {
            font-size: 12.5px !important;
            line-height: 1.2 !important;
          }

          .sales-edit-line-meta {
            font-size: 10px !important;
          }

          .sales-edit-line-controls {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .sales-edit-line-controls label,
          .sales-edit-line-controls > div {
            gap: 5px !important;
          }

          .sales-edit-line-controls span,
          .sales-edit-delivery-grid span,
          .sales-edit-items-footer small {
            font-size: 9px !important;
          }

          .sales-edit-line-controls input,
          .sales-edit-line-controls select {
            height: 39px !important;
            font-size: 12px !important;
          }

          .sales-edit-line-controls > div {
            grid-column: 1 / -1;
            min-height: 42px;
            padding: 8px 9px !important;
          }

          .sales-edit-items-footer {
            flex-shrink: 0 !important;
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
            padding: 10px 12px calc(10px + env(safe-area-inset-bottom)) !important;
            background: var(--surface) !important;
            box-shadow: 0 -14px 34px rgba(0, 0, 0, 0.18) !important;
          }

          .sales-edit-items-footer > div {
            grid-column: 1 / -1;
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            border: 1px solid var(--border);
            background: var(--surface2);
            border-radius: 13px;
            padding: 8px 10px;
          }

          .sales-edit-items-footer b {
            font-size: 15px !important;
          }

          .sales-edit-items-footer button {
            width: 100% !important;
            min-height: 42px !important;
            justify-content: center !important;
            font-size: 13px !important;
            border-radius: 13px !important;
          }
        }

        @media (max-width: 390px) {
          .sales-edit-product-count {
            max-width: 64px;
          }

          .sales-edit-line-controls {
            grid-template-columns: 1fr !important;
          }

          .sales-edit-items-footer {
            grid-template-columns: 1fr !important;
          }
        }


        /* ===== FIX MOBILE: envío visible arriba ===== */
        @media (max-width: 768px) {
          .sales-edit-delivery-card {
            order: 1 !important;
            flex: 0 0 auto !important;
            overflow: visible !important;
          }

          .sales-edit-products-picker {
            order: 2 !important;
            max-height: 30dvh !important;
          }

          .sales-edit-products-list {
            max-height: calc(30dvh - 98px) !important;
          }

          .sales-edit-lines {
            order: 3 !important;
          }

          .sales-edit-items-body {
            padding-bottom: 14px !important;
          }

          .sales-edit-delivery-card .sales-edit-lines-head {
            position: static !important;
          }

          .sales-edit-delivery-grid {
            display: grid !important;
            grid-template-columns: 1fr !important;
          }

          .sales-edit-delivery-grid label,
          .sales-edit-delivery-calc,
          .sales-edit-delivery-actions button {
            width: 100% !important;
          }
        }


      `}</style>

    </AppLayout>
  );
} 